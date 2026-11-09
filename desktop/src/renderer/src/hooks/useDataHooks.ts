import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/AppContext';
import {
  createMockAccountService,
  createMockCharacterService,
  createMockConnectionService,
  createMockEmailService,
  createMockOperationService,
} from '../services';
import {
  AccountStatus,
  AnkamaAccount,
  Character,
  CharacterStatus,
  ConnectionSnapshot,
  EmailRecord,
  EmailStatus,
  Operation,
  Page,
} from '../types/domain';

export function useEmails(params: {
  q?: string;
  status?: EmailStatus | 'all';
  page: number;
  pageSize: number;
}) {
  const { state, dispatch } = useAppStore();
  const [data, setData] = useState<Page<EmailRecord>>({
    items: [],
    total: 0,
    page: params.page,
    pageSize: params.pageSize,
  });
  const [loading, setLoading] = useState(true);

  const service = useMemo(
    () =>
      createMockEmailService(
        () => state.emails,
        (email) => dispatch({ type: 'ADD_EMAIL', payload: email }),
        (id, status) => dispatch({ type: 'SET_EMAIL_STATUS', payload: { id, status } }),
        (quantity, cost) => dispatch({ type: 'PURCHASE_EMAILS', payload: { quantity, cost } })
      ),
    [state.emails, dispatch]
  );

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await service.list(params);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [service, params.q, params.status, params.page, params.pageSize]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    data,
    loading,
    refetch,
    createEmail: service.create,
    setEmailStatus: service.setStatus,
    purchaseEmails: service.purchase,
    balance: state.simulatedBalance,
  };
}

export function useAccounts(params: {
  q?: string;
  status?: AccountStatus | 'all';
  page: number;
  pageSize: number;
}) {
  const { state, dispatch } = useAppStore();
  const [data, setData] = useState<Page<AnkamaAccount>>({
    items: [],
    total: 0,
    page: params.page,
    pageSize: params.pageSize,
  });
  const [loading, setLoading] = useState(true);

  const service = useMemo(
    () =>
      createMockAccountService(
        () => state.accounts,
        (acc) => dispatch({ type: 'ADD_ACCOUNT', payload: acc }),
        (accountId) => dispatch({ type: 'BAN_ACCOUNT', payload: { accountId } }),
        (accountId) => dispatch({ type: 'UNBAN_ACCOUNT', payload: { accountId } })
      ),
    [state.accounts, dispatch]
  );

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await service.list(params);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [service, params.q, params.status, params.page, params.pageSize]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    data,
    loading,
    refetch,
    createAccount: service.create,
    setBan: service.setBan,
  };
}

export function useCharacters(params: {
  q?: string;
  accountId?: string;
  race?: string;
  server?: string;
  status?: CharacterStatus | 'all';
  page: number;
  pageSize: number;
}) {
  const { state, dispatch } = useAppStore();
  const [data, setData] = useState<Page<Character>>({
    items: [],
    total: 0,
    page: params.page,
    pageSize: params.pageSize,
  });
  const [loading, setLoading] = useState(true);

  const service = useMemo(
    () =>
      createMockCharacterService(
        () => state.characters,
        (char) => dispatch({ type: 'ADD_CHARACTER', payload: char }),
        (id, status) => dispatch({ type: 'SET_CHARACTER_STATUS', payload: { id, status } })
      ),
    [state.characters, dispatch]
  );

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await service.list(params);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [
    service,
    params.q,
    params.accountId,
    params.race,
    params.server,
    params.status,
    params.page,
    params.pageSize,
  ]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    data,
    loading,
    refetch,
    createCharacter: service.create,
    setStatus: service.setStatus,
  };
}

export function useOperations() {
  const { state, dispatch } = useAppStore();
  const [operations, setOperations] = useState<Operation[]>(state.operations);
  const [loading, setLoading] = useState(false);

  const service = useMemo(
    () =>
      createMockOperationService(
        () => state.operations,
        (op) => dispatch({ type: 'UPDATE_OPERATION', payload: op }),
        (id, targetState) => dispatch({ type: 'RECONCILE_OPERATION', payload: { id, targetState } })
      ),
    [state.operations, dispatch]
  );

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const ops = await service.list();
      setOperations(ops);
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    setOperations(state.operations);
  }, [state.operations]);

  return {
    operations,
    loading,
    refetch,
    submitCode: service.submitCode,
    retry: service.retry,
    reconcile: service.reconcile,
  };
}

export function useConnection() {
  const { state, dispatch } = useAppStore();
  const [snapshot, setSnapshot] = useState<ConnectionSnapshot>(state.connection);
  const [checking, setChecking] = useState(false);

  const service = useMemo(
    () => createMockConnectionService(() => state.connection),
    [state.connection]
  );

  const checkNow = useCallback(async () => {
    setChecking(true);
    try {
      const res = await service.check();
      dispatch({ type: 'SET_CONNECTION', payload: res });
      setSnapshot(res);
    } finally {
      setChecking(false);
    }
  }, [service, dispatch]);

  return {
    snapshot,
    checking,
    checkNow,
  };
}

