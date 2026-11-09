import { Operation } from '../types/domain';

export const INITIAL_OPERATIONS: Operation[] = [
  {
    id: 'op-1',
    type: 'create_character',
    subject: 'ryu_warrior_012',
    state: 'uncertain',
    step: 'Confirmação do servidor de jogo',
    updatedAt: new Date(Date.now() - 12 * 60000).toISOString(),
    recoverable: false,
  },
  {
    id: 'op-2',
    type: 'create_account',
    subject: 'stock.003@mailbox.test',
    state: 'failed',
    step: 'Resolução de captcha da Ankama',
    updatedAt: new Date(Date.now() - 28 * 60000).toISOString(),
    recoverable: true,
  },
  {
    id: 'op-3',
    type: 'create_account',
    subject: 'stock.004@mailbox.test',
    state: 'running',
    step: 'Aguardando código de verificação',
    updatedAt: new Date(Date.now() - 3 * 60000).toISOString(),
    needsCode: true,
  },
  {
    id: 'op-4',
    type: 'create_character',
    subject: 'ryu_warrior_008',
    state: 'done',
    step: 'Personagem Kurogane criado com sucesso',
    updatedAt: new Date(Date.now() - 75 * 60000).toISOString(),
  },
  {
    id: 'op-5',
    type: 'import_emails',
    subject: 'Lote_Fornecedor_Alpha.csv',
    state: 'done',
    step: '48 emails importados com validação',
    updatedAt: new Date(Date.now() - 140 * 60000).toISOString(),
  },
];

