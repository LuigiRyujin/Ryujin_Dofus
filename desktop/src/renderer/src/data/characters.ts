import { Character, CharacterStatus } from '../types/domain';

const RACES = [
  'Iop',
  'Cra',
  'Eniripsa',
  'Enutrof',
  'Sram',
  'Sadida',
  'Osamodas',
  'Feca',
  'Xelor',
  'Pandawa',
  'Sacrida',
  'Zobal',
];

const SERVERS = ['Draconiros', 'Mikhal', 'Brial', 'Ilyzaelle'];

const NAMES = [
  'Kurogane', 'Shirogane', 'Akatsuki', 'Mizuchi', 'Raijin', 'Fujin', 'Susanoo',
  'Amaterasu', 'Tsukuyomi', 'Kagutsuchi', 'Yamato', 'Hayabusa', 'Kotetsu', 'Muramasa',
  'Masamune', 'Ryuunosuke', 'Shinobu', 'Kenshin', 'Tatsumaki', 'Fubuki', 'Guren',
  'Hyouketsu', 'Raiko', 'Kaze', 'Tsuchi', 'Homura', 'Suisei', 'Tenma', 'Kage', 'Tsuki',
];

const generateCharacters = (): Character[] => {
  const list: Character[] = [];

  // Distribuição estrita da especificação:
  // Total 112 = 14 Criado (C) + 63 Em Progresso (E) + 29 Finalizado (F) + 6 Banido (B)
  const statuses: CharacterStatus[] = [
    ...Array<CharacterStatus>(14).fill('C'),
    ...Array<CharacterStatus>(63).fill('E'),
    ...Array<CharacterStatus>(29).fill('F'),
    ...Array<CharacterStatus>(6).fill('B'),
  ];

  for (let i = 0; i < 112; i++) {
    const status = statuses[i] ?? 'C';
    // Personagens banidos (os últimos 6) ficam vinculados às contas banidas acc-46 e acc-47
    // Os demais distribuídos entre as contas ativas acc-1 a acc-45
    const accountId = status === 'B' 
      ? (i % 2 === 0 ? 'acc-46' : 'acc-47')
      : `acc-${(i % 45) + 1}`;

    const race = RACES[i % RACES.length] ?? 'Cra';
    const server = SERVERS[i % SERVERS.length] ?? 'Dodge';
    const baseName = NAMES[i % NAMES.length] ?? 'Ryujin';
    const suffix = Math.floor(i / NAMES.length) > 0 ? `-${Math.floor(i / NAMES.length) + 1}` : '';

    list.push({
      id: `char-${i + 1}`,
      name: `${baseName}${suffix}`,
      accountId,
      race,
      server,
      status,
    });
  }

  return list;
};

export const INITIAL_CHARACTERS = generateCharacters();

