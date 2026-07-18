import ErpDataTable from '@/components/ErpDataTable';

export default function ErpPage() {
  return (
    <div className="space-y-8 pb-24">
      <header>
        <h1 className="text-2xl font-semibold text-primary">ERP</h1>
        <p className="text-sm text-secondary">
          Invoices, orders, and inventory — served through the orchestrator gateway.
        </p>
      </header>
      <ErpDataTable />
    </div>
  );
}
