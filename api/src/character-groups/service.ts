import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { ModuleError } from '../emails/errors.js';
import { CharacterGroupRepository } from './repository.js';
import { groupIdSchema,memberIdsSchema,groupFiltersSchema } from './types.js';
import type { GroupStatus } from './types.js';

export function canTransition(from:GroupStatus,to:GroupStatus){
  return (from==='forming'&&['active','abandoned'].includes(to)) ||
    (from==='active'&&['abandoned','awaiting_restart','completed'].includes(to)) || (from==='abandoned'&&to==='active');
}
export class CharacterGroupService {
  constructor(private readonly repository:CharacterGroupRepository){}
  async completeIfAllMembersFinished(c:PoolClient,groupId:string,sessionId:string):Promise<boolean>{
    const group=await this.repository.lockGroup(c,groupId);
    if(group.status!=='active'||group.sessionId!==sessionId)throw new ModuleError(409,'GROUP_ASSIGNMENT_CHANGED','A atribuição do grupo mudou.');
    const ids=await this.repository.memberIds(c,groupId),members=await this.repository.lockCharacters(c,ids);
    if(members.length!==3||!members.every(member=>member.completedAt))return false;
    await this.repository.setState(c,groupId,'completed');
    await this.repository.event(c,groupId,'state_changed','active','completed',sessionId);return true;
  }
  private async validateMembers(c:PoolClient,groupId:string,ids:string[],complete=false,recover=false){
    if(ids.length>3||(complete&&ids.length!==3))throw new ModuleError(409,'GROUP_CARDINALITY','O grupo operacional exige três integrantes.');
    const members=await this.repository.lockCharacters(c,ids);
    if(members.length!==ids.length)throw new ModuleError(404,'CHARACTER_NOT_FOUND','Personagem não encontrado.');
    if(new Set(members.map(m=>m.breedId)).size!==ids.length||new Set(members.map(m=>m.ankamaId)).size!==ids.length||new Set(members.map(m=>m.serverId)).size>1)
      throw new ModuleError(409,'GROUP_COMPOSITION','Exija classes e contas distintas no mesmo servidor.');
    if(members.some(m=>(!recover&&m.completedAt)||!['C','E','P'].includes(m.status)||m.accountStatus==='B')||
      (recover&&members.length>0&&members.every(m=>m.completedAt)))
      throw new ModuleError(409,'CHARACTER_INELIGIBLE','Personagem concluído ou indisponível para formação.');
    await this.repository.assertReservations(c,groupId,ids);
  }
  async createGroup(characterIds:string[]=[]){
    const ids=memberIdsSchema.parse(characterIds);
    const id=await this.repository.transaction(c=>this.createInTransaction(c,ids));
    return this.repository.get(id);
  }
  async createInTransaction(c:PoolClient,ids:string[]):Promise<string>{
    memberIdsSchema.parse(ids);const id=randomUUID();
    await this.repository.insertGroup(c,id);await this.validateMembers(c,id,ids);
    await this.repository.event(c,id,'created',null,'forming');
    for(const characterId of ids){await this.repository.addMember(c,id,characterId);await this.repository.event(c,id,'member_added','forming','forming',null,null,characterId);}
    return id;
  }
  async activateInTransaction(c:PoolClient,id:string,session:string,source:'forming'|'abandoned'){
    await this.repository.lockSession(c,session,false);
    const group=await this.repository.lockGroup(c,id);
    if(group.status==='active'&&group.sessionId===session)return;
    if(group.status!==source)throw new ModuleError(409,'GROUP_TRANSITION','Transição de grupo inválida.');
    await this.validateMembers(c,id,await this.repository.memberIds(c,id),true,source==='abandoned');
    const slot=await this.repository.availableSlot(c,session);
    await this.repository.lockSession(c,session);
    await this.repository.setState(c,id,'active',session,slot);
    await this.repository.event(c,id,'state_changed',group.status,'active',group.sessionId,session);
  }
  async addMember(groupId:string,characterId:string){
    const id=groupIdSchema.parse(groupId),memberId=groupIdSchema.parse(characterId);
    await this.repository.transaction(async c=>{
      const group=await this.repository.lockGroup(c,id);
      if(group.status!=='forming')throw new ModuleError(409,'GROUP_IMMUTABLE','A composição só pode mudar em formação.');
      const ids=await this.repository.memberIds(c,id);
      if(ids.includes(memberId))throw new ModuleError(409,'MEMBER_DUPLICATE','Personagem já pertence ao grupo.');
      await this.validateMembers(c,id,[...ids,memberId]);await this.repository.addMember(c,id,memberId);
      await this.repository.event(c,id,'member_added','forming','forming',null,null,memberId);
    });return this.repository.get(id);
  }
  async removeMember(groupId:string,characterId:string){
    const id=groupIdSchema.parse(groupId),memberId=groupIdSchema.parse(characterId);
    await this.repository.transaction(async c=>{
      const group=await this.repository.lockGroup(c,id);
      if(group.status!=='forming')throw new ModuleError(409,'GROUP_IMMUTABLE','A composição só pode mudar em formação.');
      await this.repository.removeMember(c,id,memberId);await this.repository.event(c,id,'member_removed','forming','forming',null,null,memberId);
    });return this.repository.get(id);
  }
  private async transition(groupId:string,target:GroupStatus,sessionId?:string,requiredSource?:GroupStatus){
    const id=groupIdSchema.parse(groupId),session=sessionId===undefined?undefined:groupIdSchema.parse(sessionId);
    await this.repository.transaction(async c=>{
      // Domain lock order: target session, group, accounts sorted by ID, characters sorted by ID.
      if(session)await this.repository.lockSession(c,session,false);
      const previousSession=await this.repository.currentSession(c,id);
      if(!session&&previousSession)await this.repository.lockSession(c,previousSession,false);
      const group=await this.repository.lockGroup(c,id);
      if(!session&&group.sessionId!==previousSession)throw new ModuleError(409,'GROUP_ASSIGNMENT_CHANGED','A atribuição mudou; repita a operação.');
      if(group.status===target){
        if(target==='active'&&group.sessionId!==session)throw new ModuleError(409,'GROUP_ALREADY_ASSIGNED','Grupo já atribuído a outra sessão.');
        return;
      }
      if((requiredSource&&group.status!==requiredSource)||!canTransition(group.status,target))throw new ModuleError(409,'GROUP_TRANSITION','Transição de grupo inválida.');
      let slot:number|null=null;
      if(target==='active'){
        if(!session)throw new ModuleError(400,'SESSION_REQUIRED','Sessão obrigatória.');
        await this.validateMembers(c,id,await this.repository.memberIds(c,id),true,group.status==='abandoned');
        slot=await this.repository.availableSlot(c,session);
        // Revalidate the clock after all potentially blocking locks, just before assignment.
        await this.repository.lockSession(c,session);
      }
      if(target==='completed')await this.repository.lockCharacters(c,await this.repository.memberIds(c,id));
      await this.repository.setState(c,id,target,session??null,slot);
      await this.repository.event(c,id,'state_changed',group.status,target,group.sessionId,session??null);
    });return this.repository.get(id);
  }
  activateGroup(groupId:string,sessionId:string){return this.transition(groupId,'active',sessionId,'forming');}
  resumeGroup(groupId:string,sessionId:string){return this.transition(groupId,'active',sessionId,'abandoned');}
  abandonGroup(groupId:string){return this.transition(groupId,'abandoned');}
  awaitRestart(groupId:string){return this.transition(groupId,'awaiting_restart');}
  completeGroup(groupId:string){return this.transition(groupId,'completed');}
  getGroup(groupId:string){return this.repository.get(groupIdSchema.parse(groupId));}
  getEvents(groupId:string){return this.repository.events(groupIdSchema.parse(groupId));}
  listGroups(filters:unknown={}){return this.repository.list(groupFiltersSchema.parse(filters));}
}
