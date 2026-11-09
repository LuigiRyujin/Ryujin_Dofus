export class SessionExpirationJob {
  private timer:ReturnType<typeof setTimeout>|undefined;
  private running:Promise<void>|undefined;
  private stopped=false;
  constructor(private readonly expire:()=>Promise<number>,private readonly intervalMs:number,
    private readonly success:(count:number)=>void,private readonly failure:()=>void){}
  start():Promise<void>{
    if(this.stopped)return Promise.resolve();
    if(this.running)return this.running;
    if(this.timer)return Promise.resolve();
    // Keep the promise assigned even if a synchronous callback throws.
    this.running=this.tick();return this.running;
  }
  private async tick(){
    await Promise.resolve();
    try{const count=await this.expire();this.success(count);}catch{this.failure();}
    finally{
      this.running=undefined;
      if(!this.stopped){this.timer=setTimeout(()=>{this.timer=undefined;void this.start();},this.intervalMs);this.timer.unref();}
    }
  }
  async stop(){this.stopped=true;if(this.timer)clearTimeout(this.timer);await this.running;}
}
