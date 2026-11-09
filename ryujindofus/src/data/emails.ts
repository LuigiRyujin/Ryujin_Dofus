import { EmailRecord } from '../types/domain';

// Gerador de dados determinísticos para testes e demonstração
const generateEmails = (): EmailRecord[] => {
  const list: EmailRecord[] = [];

  // 47 emails Utilizados ('U'), vinculados às 47 contas Ankama
  for (let i = 1; i <= 47; i++) {
    const pad = String(i).padStart(3, '0');
    list.push({
      id: `email-u-${i}`,
      address: `operator.${pad}@mailbox.test`,
      origin: i % 3 === 0 ? 'Importação CSV' : i % 2 === 0 ? 'Loja Parceira' : 'Cadastro Manual',
      purchasedAt: new Date(Date.now() - (50 - i) * 86400000).toISOString(),
      status: 'U',
      password: `K9#mQ${pad}!xZ`,
    });
  }

  // 128 emails Disponíveis ('D') no estoque
  for (let i = 1; i <= 128; i++) {
    const pad = String(i).padStart(3, '0');
    list.push({
      id: `email-d-${i}`,
      address: `stock.${pad}@mailbox.test`,
      origin: i % 4 === 0 ? 'Importação Lote 14' : i % 3 === 0 ? 'Loja Alpha' : 'Compra Direta',
      purchasedAt: new Date(Date.now() - (130 - i) * 3600000 * 4).toISOString(),
      status: 'D',
      password: `Pass#D${pad}$88`,
    });
  }

  // 12 emails Bloqueados ('B') para teste e paginação completa
  for (let i = 1; i <= 12; i++) {
    const pad = String(i).padStart(3, '0');
    list.push({
      id: `email-b-${i}`,
      address: `blocked.${pad}@mailbox.test`,
      origin: 'Importação Antiga',
      purchasedAt: new Date(Date.now() - (200 - i) * 86400000).toISOString(),
      status: 'B',
      password: `Blk#Sec${pad}!`,
    });
  }

  return list;
};

export const INITIAL_EMAILS = generateEmails();

