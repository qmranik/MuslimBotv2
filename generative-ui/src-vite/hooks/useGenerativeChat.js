import { useState, useCallback } from 'react';
import { runNLPRouter, invalidateERPCache } from '../services/gemini';
import {
  checkERPConnection,
  fetchERPContext,
  createStockEntry,
  createItem,
  createCustomer,
  createSalesInvoice,
  recordPayment,
  posCheckout,
  updateCustomer,
} from '../services/erpClient';

export function useGenerativeChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [erpConnected, setErpConnected] = useState(false);
  const [dataSource, setDataSource] = useState('mock');
  const [actionStates, setActionStates] = useState({});

  const initErp = useCallback(async () => {
    try {
      const connected = await checkERPConnection();
      setErpConnected(connected);
      if (connected) {
        const ctx = await fetchERPContext();
        if (ctx?._meta) setDataSource('live');
      }
    } catch {
      setErpConnected(false);
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setInput('');
    setActionStates({});
  }, []);

  const handleSubmit = useCallback(async (e, customPrompt = null) => {
    if (e) e.preventDefault();
    const promptToSend = customPrompt || input;
    if (!promptToSend.trim()) return;
    if (!customPrompt) setInput('');

    setMessages((prev) => [...prev, { id: Date.now(), sender: 'user', text: promptToSend }]);
    setIsLoading(true);

    try {
      const history = messages
        .filter((m) => m.component === 'text' || m.sender === 'user')
        .map((m) => ({
          sender: m.sender,
          text: m.sender === 'user' ? m.text : m.explanation,
        }))
        .slice(-6);

      const result = await runNLPRouter(promptToSend, history);
      if (result._dataSource) setDataSource(result._dataSource);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          component: result.component,
          title: result.title,
          chartType: result.chartType,
          columns: result.columns,
          data: result.data,
          metrics: result.metrics,
          cardDetails: result.cardDetails,
          actionType: result.actionType,
          actionParams: result.actionParams,
          explanation: result.explanation,
          missingFields: result.missingFields,
          _dataSource: result._dataSource,
        },
      ]);
      if (result._dataSource === 'live' || result._dataSource === 'cache') {
        setDataSource('live');
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          component: 'text',
          explanation: 'Router connection error. Check network or API key.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages]);

  const handleExecuteAction = useCallback(async (msgId, actionType, actionParams) => {
    if (!erpConnected && dataSource === 'live') {
      setActionStates((prev) => ({
        ...prev,
        [msgId]: { status: 'error', error: 'ERP offline — writes blocked.' },
      }));
      return;
    }

    setActionStates((prev) => ({ ...prev, [msgId]: { status: 'submitting', error: null } }));

    try {
      let res;
      if (!erpConnected || dataSource === 'mock') {
        await new Promise((r) => setTimeout(r, 800));
        res = { name: `MOCK-${actionType}-${Math.floor(Math.random() * 10000)}` };
      } else {
        switch (actionType) {
          case 'create_stock_entry':
            res = await createStockEntry(actionParams);
            break;
          case 'create_item':
            res = await createItem(actionParams);
            break;
          case 'create_customer':
            res = await createCustomer(actionParams);
            break;
          case 'create_invoice':
            res = await createSalesInvoice(actionParams);
            break;
          case 'record_payment':
            res = await recordPayment(actionParams);
            break;
          case 'pos_checkout':
            res = await posCheckout(actionParams);
            break;
          case 'update_customer':
            res = await updateCustomer(actionParams);
            break;
          default:
            throw new Error(`Unknown action: ${actionType}`);
        }
      }

      setActionStates((prev) => ({ ...prev, [msgId]: { status: 'success', result: res } }));
      invalidateERPCache();
      window.dispatchEvent(new CustomEvent('erp:cache:invalidate'));
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: 'ai',
          component: 'text',
          explanation: `Success: \`${res?.name || res?.payment || 'OK'}\` submitted to ERP.`,
        },
      ]);
    } catch (err) {
      setActionStates((prev) => ({
        ...prev,
        [msgId]: { status: 'error', error: err.message || 'Request failed' },
      }));
    }
  }, [erpConnected, dataSource]);

  const handleCancelAction = useCallback((msgId) => {
    setActionStates((prev) => ({ ...prev, [msgId]: { status: 'cancelled' } }));
  }, []);

  return {
    messages,
    input,
    setInput,
    isLoading,
    erpConnected,
    dataSource,
    actionStates,
    initErp,
    clearChat,
    handleSubmit,
    handleExecuteAction,
    handleCancelAction,
  };
}
