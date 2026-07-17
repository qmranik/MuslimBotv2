"use client";
import { useState, useCallback } from 'react';
import { runNLPRouter, invalidateERPCache } from '../services/gemini';
import { checkERPConnection, fetchERPContext } from '../services/erpClient';
import { executeServerTool } from '../services/serverBrain';

const ACTION_TO_TOOL = {
  create_stock_entry: 'add_stock',
  add_stock: 'add_stock',
  create_item: 'create_item',
  create_customer: 'create_customer',
  create_invoice: 'create_order',
  create_order: 'create_order',
  record_payment: 'record_payment',
  pos_checkout: 'create_order',
  trigger_workflow: 'trigger_workflow',
  send_notification: 'send_notification',
};

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
          explanation: 'Router connection error. Check orchestrator /v1/ai/generate-ui.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages]);

  const handleExecuteAction = useCallback(async (msgId, actionType, actionParams) => {
    setActionStates((prev) => ({ ...prev, [msgId]: { status: 'submitting', error: null } }));

    try {
      const tool = ACTION_TO_TOOL[actionType] || actionType;
      const result = await executeServerTool(tool, actionParams || {}, true);
      if (!result?.ok) {
        throw new Error(result?.error || 'Tool execution failed');
      }

      const name =
        result?.data?.name ||
        result?.data?.payment ||
        result?.data?.status ||
        tool;

      setActionStates((prev) => ({ ...prev, [msgId]: { status: 'success', result: result.data } }));
      invalidateERPCache();
      window.dispatchEvent(new CustomEvent('erp:cache:invalidate'));
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: 'ai',
          component: 'text',
          explanation: `Success: \`${typeof name === 'string' ? name : 'OK'}\` via /v1/ai/tool/execute.`,
        },
      ]);
    } catch (err) {
      setActionStates((prev) => ({
        ...prev,
        [msgId]: { status: 'error', error: err.message || 'Request failed' },
      }));
    }
  }, []);

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
