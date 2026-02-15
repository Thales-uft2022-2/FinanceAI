import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatShortDate } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { 
  Wallet, TrendingUp, TrendingDown, Target, ArrowRight,
  Plus, Sparkles
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const chartColors = ['#22C55E', '#EF4444', '#3B82F6', '#A855F7', '#F59E0B', '#EC4899'];

  return (
    <div className="space-y-8 animate-fade-in" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Olá, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-muted-foreground mt-1">
            Aqui está o resumo das suas finanças
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => navigate('/transactions')}
            className="rounded-full gap-2"
            data-testid="add-transaction-btn"
          >
            <Plus className="w-4 h-4" />
            Nova Transação
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate('/ai-tips')}
            className="rounded-full gap-2"
            data-testid="ai-tips-btn"
          >
            <Sparkles className="w-4 h-4" />
            Dicas IA
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
        <Card className="bg-card border-border hover:border-primary/20 transition-colors" data-testid="balance-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Total</CardTitle>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${stats?.total_balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatCurrency(stats?.total_balance || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.transactions_count || 0} transações
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover:border-primary/20 transition-colors" data-testid="income-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle>
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-500">
              {formatCurrency(stats?.total_income || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total de entradas</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover:border-destructive/20 transition-colors" data-testid="expense-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-destructive">
              {formatCurrency(stats?.total_expenses || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total de saídas</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border hover:border-chart-4/20 transition-colors" data-testid="goals-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Metas</CardTitle>
            <div className="w-10 h-10 rounded-full bg-chart-4/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-chart-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {stats?.goals_count || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Metas ativas</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Area Chart */}
        <Card className="lg:col-span-8 bg-card border-border" data-testid="monthly-chart">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Fluxo Mensal</span>
              <Button variant="ghost" size="sm" onClick={() => navigate('/transactions')} className="gap-1">
                Ver tudo <ArrowRight className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.monthly_data || []}>
                  <defs>
                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="month" 
                    stroke="#71717A" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#71717A" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `R$${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181B', 
                      border: '1px solid #27272A',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="income" 
                    stroke="#22C55E" 
                    fill="url(#incomeGradient)"
                    strokeWidth={2}
                    name="Receitas"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="expense" 
                    stroke="#EF4444" 
                    fill="url(#expenseGradient)"
                    strokeWidth={2}
                    name="Despesas"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="lg:col-span-4 bg-card border-border" data-testid="categories-chart">
          <CardHeader>
            <CardTitle>Gastos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {stats?.categories_by_expense?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.categories_by_expense}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {stats.categories_by_expense.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#18181B', 
                        border: '1px solid #27272A',
                        borderRadius: '8px'
                      }}
                      formatter={(value) => formatCurrency(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Sem dados de despesas
                </div>
              )}
            </div>
            {/* Legend */}
            <div className="mt-4 space-y-2">
              {stats?.categories_by_expense?.slice(0, 4).map((cat, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: cat.color || chartColors[index % chartColors.length] }}
                    />
                    <span className="text-muted-foreground">{cat.name}</span>
                  </div>
                  <span className="font-mono">{formatCurrency(cat.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="bg-card border-border" data-testid="recent-transactions">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Transações Recentes</span>
            <Button variant="ghost" size="sm" onClick={() => navigate('/transactions')} className="gap-1">
              Ver todas <ArrowRight className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recent_transactions?.length > 0 ? (
            <div className="space-y-4">
              {stats.recent_transactions.map((transaction) => (
                <div 
                  key={transaction.id} 
                  className="flex items-center justify-between p-4 rounded-xl bg-background/50 hover:bg-background/80 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${transaction.category_color}20` }}
                    >
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: transaction.category_color }}
                      />
                    </div>
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {transaction.category_name} • {formatShortDate(transaction.date)}
                      </p>
                    </div>
                  </div>
                  <span className={`font-mono font-semibold ${
                    transaction.type === 'income' ? 'text-primary' : 'text-destructive'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma transação ainda</p>
              <Button 
                variant="link" 
                onClick={() => navigate('/transactions')}
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
