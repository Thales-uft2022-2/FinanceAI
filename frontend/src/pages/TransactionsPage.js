import { useState, useEffect } from 'react';
import axios from 'axios';
import { formatCurrency, formatDate } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { 
  Plus, Trash2, Edit2, TrendingUp, TrendingDown, 
  CalendarIcon, Search, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: 'expense',
    category_id: '',
    date: new Date()
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [transRes, catRes] = await Promise.all([
        axios.get(`${API_URL}/api/transactions`),
        axios.get(`${API_URL}/api/categories`)
      ]);
      setTransactions(transRes.data);
      setCategories(catRes.data);
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        date: formData.date.toISOString()
      };
      
      if (editingTransaction) {
        await axios.put(`${API_URL}/api/transactions/${editingTransaction.id}`, payload);
        toast.success('Transação atualizada!');
      } else {
        await axios.post(`${API_URL}/api/transactions`, payload);
        toast.success('Transação adicionada!');
      }
      
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Erro ao salvar transação');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir esta transação?')) return;
    try {
      await axios.delete(`${API_URL}/api/transactions/${id}`);
      toast.success('Transação excluída!');
      fetchData();
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      description: transaction.description,
      amount: transaction.amount.toString(),
      type: transaction.type,
      category_id: transaction.category_id,
      date: new Date(transaction.date)
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      description: '',
      amount: '',
      type: 'expense',
      category_id: '',
      date: new Date()
    });
    setEditingTransaction(null);
  };

  const filteredCategories = categories.filter(c => c.type === formData.type);
  
  const filteredTransactions = transactions.filter(t => {
    const matchesType = filterType === 'all' || t.type === filterType;
    const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         t.category_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const totals = {
    income: transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
    expense: transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  };
  
  // Saldo = Receitas - Despesas
  const saldo = totals.income - totals.expense;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="transactions-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transações</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas receitas e despesas
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="rounded-full gap-2" data-testid="add-transaction-dialog-btn">
              <Plus className="w-4 h-4" />
              Nova Transação
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingTransaction ? 'Editar Transação' : 'Nova Transação'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <Tabs value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v, category_id: '' })}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="expense" className="gap-2" data-testid="expense-tab">
                    <TrendingDown className="w-4 h-4" /> Despesa
                  </TabsTrigger>
                  <TabsTrigger value="income" className="gap-2" data-testid="income-tab">
                    <TrendingUp className="w-4 h-4" /> Receita
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  data-testid="transaction-description-input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex: Almoço, Salário..."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  data-testid="transaction-amount-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0,00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select 
                  value={formData.category_id} 
                  onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                  required
                >
                  <SelectTrigger data-testid="transaction-category-select">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="transaction-date-picker"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(formData.date, "PPP", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.date}
                      onSelect={(date) => date && setFormData({ ...formData, date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button type="submit" className="w-full rounded-full" data-testid="save-transaction-btn">
                {editingTransaction ? 'Salvar Alterações' : 'Adicionar Transação'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`${saldo >= 0 ? 'bg-primary/10 border-primary/20' : 'bg-destructive/10 border-destructive/20'}`}>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Saldo Disponível</p>
              <p className={`text-2xl font-bold font-mono ${saldo >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatCurrency(saldo)}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${saldo >= 0 ? 'bg-primary/20' : 'bg-destructive/20'}`}>
              {saldo >= 0 ? <TrendingUp className="w-5 h-5 text-primary" /> : <TrendingDown className="w-5 h-5 text-destructive" />}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Receitas</p>
              <p className="text-2xl font-bold font-mono text-emerald-500">
                {formatCurrency(totals.income)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-500" />
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Despesas</p>
              <p className="text-2xl font-bold font-mono text-destructive">
                {formatCurrency(totals.expense)}
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-destructive" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="search-transactions-input"
            placeholder="Buscar transações..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={filterType} onValueChange={setFilterType} className="w-full md:w-auto">
          <TabsList>
            <TabsTrigger value="all" data-testid="filter-all">Todas</TabsTrigger>
            <TabsTrigger value="income" data-testid="filter-income">Receitas</TabsTrigger>
            <TabsTrigger value="expense" data-testid="filter-expense">Despesas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Transactions List */}
      <Card className="bg-card border-border" data-testid="transactions-list">
        <CardContent className="p-0">
          {filteredTransactions.length > 0 ? (
            <div className="divide-y divide-border">
              {filteredTransactions.map((transaction) => (
                <div 
                  key={transaction.id}
                  className="flex items-center justify-between p-4 hover:bg-background/50 transition-colors"
                  data-testid={`transaction-item-${transaction.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${transaction.category_color}20` }}
                    >
                      {transaction.type === 'income' ? (
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {transaction.category_name} • {formatDate(transaction.date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-mono font-semibold ${
                      transaction.type === 'income' ? 'text-emerald-500' : 'text-destructive'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </span>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleEdit(transaction)}
                        data-testid={`edit-transaction-${transaction.id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDelete(transaction.id)}
                        className="text-destructive hover:text-destructive"
                        data-testid={`delete-transaction-${transaction.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nenhuma transação encontrada</p>
              <Button 
                variant="link" 
                onClick={() => setIsDialogOpen(true)}
                className="mt-2"
              >
                Adicionar primeira transação
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
