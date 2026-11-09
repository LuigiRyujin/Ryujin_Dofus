import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import {
  AccountStatus,
  AnkamaAccount,
  Character,
  CharacterStatus,
  ConnectionSnapshot,
  EmailRecord,
  EmailStatus,
  Operation,
} from '../types/domain';
import { INITIAL_EMAILS } from '../data/emails';
import { INITIAL_ACCOUNTS } from '../data/accounts';
import { INITIAL_CHARACTERS } from '../data/characters';
import { INITIAL_OPERATIONS } from '../data/operations';
import { INITIAL_CONNECTION } from '../data/connection';

export interface AppState {
  emails: EmailRecord[];
  accounts: AnkamaAccount[];
  characters: Character[];
  operations: Operation[];
  connection: ConnectionSnapshot;
  simulatedBalance: number; // Saldo simulado para compras (ex: R$ 250,00)
}

export type AppAction =
  | { type: 'ADD_EMAIL'; payload: { address: string; origin: string; password?: string } }
  | { type: 'SET_EMAIL_STATUS'; payload: { id: string; status: EmailStatus } }
  | { type: 'PURCHASE_EMAILS'; payload: { quantity: number; cost: number } }
  | { type: 'IMPORT_EMAILS'; payload: { emails: Array<{ address: string; origin: string; password?: string }> } }
  | { type: 'ADD_ACCOUNT'; payload: { login: string; emailId: string; password?: string } }
  | { type: 'BAN_ACCOUNT'; payload: { accountId: string } }
  | { type: 'UNBAN_ACCOUNT'; payload: { accountId: string } }
  | { type: 'ADD_CHARACTER'; payload: { name: string; accountId: string; race: string; server: string } }
  | { type: 'SET_CHARACTER_STATUS'; payload: { id: string; status: CharacterStatus } }
  | { type: 'UPDATE_OPERATION'; payload: Operation }
  | { type: 'RECONCILE_OPERATION'; payload: { id: string; targetState: 'done' | 'failed' } }
  | { type: 'SET_CONNECTION'; payload: ConnectionSnapshot };

const initialState: AppState = {
  emails: INITIAL_EMAILS,
  accounts: INITIAL_ACCOUNTS,
  characters: INITIAL_CHARACTERS,
  operations: INITIAL_OPERATIONS,
  connection: INITIAL_CONNECTION,
  simulatedBalance: 250.0,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_EMAIL': {
      const newEmail: EmailRecord = {
        id: `email-manual-${Date.now()}`,
        address: action.payload.address,
        origin: action.payload.origin || 'Cadastro Manual',
        purchasedAt: new Date().toISOString(),
        status: 'D',
        password: action.payload.password || 'SimulatedPass#123',
      };
      return {
        ...state,
        emails: [newEmail, ...state.emails],
      };
    }

    case 'SET_EMAIL_STATUS': {
      return {
        ...state,
        emails: state.emails.map((e) =>
          e.id === action.payload.id ? { ...e, status: action.payload.status } : e
        ),
      };
    }

    case 'PURCHASE_EMAILS': {
      const { quantity, cost } = action.payload;
      const newEmails: EmailRecord[] = [];
      const now = new Date().toISOString();
      for (let i = 1; i <= quantity; i++) {
        newEmails.push({
          id: `email-purchased-${Date.now()}-${i}`,
          address: `bought.${Math.floor(Math.random() * 89999 + 10000)}@mailbox.test`,
          origin: 'Compra Simulada',
          purchasedAt: now,
          status: 'D',
          password: `BuyPass#${Math.floor(Math.random() * 8999 + 1000)}`,
        });
      }
      return {
        ...state,
        simulatedBalance: Math.max(0, state.simulatedBalance - cost),
        emails: [...newEmails, ...state.emails],
      };
    }

    case 'IMPORT_EMAILS': {
      const imported: EmailRecord[] = action.payload.emails.map((item, idx) => ({
        id: `email-import-${Date.now()}-${idx}`,
        address: item.address,
        origin: item.origin || 'Importação Lote',
        purchasedAt: new Date().toISOString(),
        status: 'D',
        password: item.password || 'ImpPass#999',
      }));
      return {
        ...state,
        emails: [...imported, ...state.emails],
      };
    }

    case 'ADD_ACCOUNT': {
      // Regra 1: O email escolhido passa de 'D' para 'U' e fica vinculado à conta
      const { login, emailId, password } = action.payload;
      const newAccount: AnkamaAccount = {
        id: `acc-${Date.now()}`,
        login,
        emailId,
        status: 'C',
        createdAt: new Date().toISOString(),
        password: password || 'AkPass#777',
      };

      const updatedEmails = state.emails.map((e) =>
        e.id === emailId ? { ...e, status: 'U' as EmailStatus } : e
      );

      return {
        ...state,
        accounts: [newAccount, ...state.accounts],
        emails: updatedEmails,
      };
    }

    case 'BAN_ACCOUNT': {
      // Regra 3: Banir conta -> conta B e TODOS os seus personagens B
      const { accountId } = action.payload;
      const updatedAccounts = state.accounts.map((acc) =>
        acc.id === accountId ? { ...acc, status: 'B' as AccountStatus } : acc
      );
      const updatedCharacters = state.characters.map((char) =>
        char.accountId === accountId ? { ...char, status: 'B' as CharacterStatus } : char
      );
      return {
        ...state,
        accounts: updatedAccounts,
        characters: updatedCharacters,
      };
    }

    case 'UNBAN_ACCOUNT': {
      // Regra 4: Retirar banimento -> conta volta a C; personagens PERMANECEM B
      const { accountId } = action.payload;
      const updatedAccounts = state.accounts.map((acc) =>
        acc.id === accountId ? { ...acc, status: 'C' as AccountStatus } : acc
      );
      return {
        ...state,
        accounts: updatedAccounts,
        // personagens permanecem intactos!
      };
    }

    case 'ADD_CHARACTER': {
      // Regra 5: O email é herdado automaticamente da conta; status inicial 'C'
      const newChar: Character = {
        id: `char-${Date.now()}`,
        name: action.payload.name,
        accountId: action.payload.accountId,
        race: action.payload.race,
        server: action.payload.server,
        status: 'C',
      };
      return {
        ...state,
        characters: [newChar, ...state.characters],
      };
    }

    case 'SET_CHARACTER_STATUS': {
      // Edição administrativa: qualquer transição é permitida
      return {
        ...state,
        characters: state.characters.map((char) =>
          char.id === action.payload.id ? { ...char, status: action.payload.status } : char
        ),
      };
    }

    case 'UPDATE_OPERATION': {
      return {
        ...state,
        operations: state.operations.map((op) =>
          op.id === action.payload.id ? action.payload : op
        ),
      };
    }

    case 'RECONCILE_OPERATION': {
      return {
        ...state,
        operations: state.operations.map((op) =>
          op.id === action.payload.id
            ? {
                ...op,
                state: action.payload.targetState,
                step:
                  action.payload.targetState === 'done'
                    ? 'Reconciliação concluída com sucesso'
                    : 'Reconciliação confirmou falha irrecuperável',
                updatedAt: new Date().toISOString(),
              }
            : op
        ),
      };
    }

    case 'SET_CONNECTION': {
      return {
        ...state,
        connection: action.payload,
      };
    }

    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  metrics: {
    availableEmails: number;
    accountsCount: number;
    charactersInProgress: number;
    finishedCharacters: number;
    totalCharacters: number;
    charactersByStatus: {
      C: number;
      E: number;
      F: number;
      B: number;
    };
  };
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppStoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Métricas derivadas dinamicamente dos dados (Regra 7)
  const availableEmails = state.emails.filter((e) => e.status === 'D').length;
  const accountsCount = state.accounts.length;
  const charactersInProgress = state.characters.filter((c) => c.status === 'E').length;
  const finishedCharacters = state.characters.filter((c) => c.status === 'F').length;

  const charactersByStatus = {
    C: state.characters.filter((c) => c.status === 'C').length,
    E: state.characters.filter((c) => c.status === 'E').length,
    F: state.characters.filter((c) => c.status === 'F').length,
    B: state.characters.filter((c) => c.status === 'B').length,
  };

  const totalCharacters = state.characters.length;

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        metrics: {
          availableEmails,
          accountsCount,
          charactersInProgress,
          finishedCharacters,
          totalCharacters,
          charactersByStatus,
        },
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppStore must be used within an AppStoreProvider');
  }
  return ctx;
};

