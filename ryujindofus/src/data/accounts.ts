import { AnkamaAccount } from '../types/domain';

const generateAccounts = (): AnkamaAccount[] => {
  const list: AnkamaAccount[] = [];

  // 47 contas vinculadas aos 47 emails com status 'U'
  // Contas 46 e 47 iniciam banidas para demonstrar o status 'B'
  for (let i = 1; i <= 47; i++) {
    const pad = String(i).padStart(3, '0');
    const isBanned = i >= 46;
    list.push({
      id: `acc-${i}`,
      login: `ryu_warrior_${pad}`,
      emailId: `email-u-${i}`,
      status: isBanned ? 'B' : 'C',
      createdAt: new Date(Date.now() - (48 - i) * 86400000 * 2).toISOString(),
      password: `Ak#Sec${pad}!9`,
    });
  }

  return list;
};

export const INITIAL_ACCOUNTS = generateAccounts();

