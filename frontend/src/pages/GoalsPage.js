import { useState, useEffect } from 'react';
import axios from 'axios';
import { formatCurrency } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Plus, Trash2, Edit2, Target, CalendarIcon, Trophy, PiggyBank } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [addAmountId, setAddAmountId] = useState(null);
  const [addAmount, setAddAmount] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    target_amount: '',
    current_amount: '0',
    deadline: null
  });

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/goals`);
      setGoals(response.data);
    } catch (error) {
      toast.error('Erro ao carregar metas');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        target_amount: parseFloat(formData.target_amount),
        current_amount: parseFloat(formData.current_amount) || 0,
        deadline: formData.deadline ? formData.deadline.toISOString() : null
      };
      
      if (editingGoal) {
        await axios.put(`${API_URL}/api/goals/${editingGoal.id}`, payload);
        toast.success('Meta atualizada!');
      } else {
        await axios.post(`${API_URL}/api/goals`, payload);
        toast.success('Meta criada!');
      }
      
      setIsDialogOpen(false);
      resetForm();
      fetchGoals();
    } catch (error) {
      toast.error('Erro ao salvar meta');
    }
  };

  const handleAddAmount = async (goalId) => {
    if (!addAmount || parseFloat(addAmount) <= 0) return;
    
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    
    try {
      await axios.put(`${API_URL}/api/goals/${goalId}`, {
        current_amount: goal.current_amount + parseFloat(addAmount)
      });
      toast.success('Valor adicionado!');
      setAddAmountId(null);
      setAddAmount('');
      fetchGoals();
    } catch (error) {
      toast.error('Erro ao adicionar valor');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir esta meta?')) return;
    try {
      await axios.delete(`${API_URL}/api/goals/${id}`);
      toast.success('Meta excluída!');
      fetchGoals();
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  const handleEdit = (goal) => {
    setEditingGoal(goal);
    setFormData({
      name: goal.name,
      target_amount: goal.target_amount.toString(),
      current_amount: goal.current_amount.toString(),
      deadline: goal.deadline ? new Date(goal.deadline) : null
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      target_amount: '',
      current_amount: '0',
      deadline: null
    });
    setEditingGoal(null);
  };

  const completedGoals = goals.filter(g => g.progress >= 100).length;
  const totalSaved = goals.reduce((sum, g) => sum + g.current_amount, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.target_amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="goals-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Metas</h1>
          <p className="text-muted-foreground mt-1">
            Defina objetivos e acompanhe seu progresso
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="rounded-full gap-2" data-testid="add-goal-btn">
              <Plus className="w-4 h-4" />
              Nova Meta
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingGoal ? 'Editar Meta' : 'Nova Meta'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Nome da Meta</Label>
                <Input
                  data-testid="goal-name-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Viagem, Carro novo..."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Valor Alvo (R$)</Label>
                <Input
                  data-testid="goal-target-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.target_amount}
                  onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                  placeholder="10000,00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Valor Atual (R$)</Label>
                <Input
                  data-testid="goal-current-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.current_amount}
                  onChange={(e) => setFormData({ ...formData, current_amount: e.target.value })}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label>Prazo (Opcional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="goal-deadline-picker"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.deadline ? format(formData.deadline, "PPP", { locale: ptBR }) : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.deadline}
                      onSelect={(date) => setFormData({ ...formData, deadline: date })}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button type="submit" className="w-full rounded-full" data-testid="save-goal-btn">
                {editingGoal ? 'Salvar Alterações' : 'Criar Meta'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Metas Ativas</p>
              <p className="text-2xl font-bold font-mono">{goals.length}</p>
            </div>
            <Target className="w-8 h-8 text-primary" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Metas Concluídas</p>
              <p className="text-2xl font-bold font-mono text-emerald-500">{completedGoals}</p>
            </div>
            <Trophy className="w-8 h-8 text-emerald-500" />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Guardado</p>
              <p className="text-2xl font-bold font-mono text-chart-4">{formatCurrency(totalSaved)}</p>
            </div>
            <PiggyBank className="w-8 h-8 text-chart-4" />
          </CardContent>
        </Card>
      </div>

      {/* Goals Grid */}
      {goals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.map((goal) => (
            <Card 
              key={goal.id} 
              className={`bg-card border-border hover:border-primary/20 transition-colors ${
                goal.progress >= 100 ? 'border-emerald-500/50' : ''
              }`}
              data-testid={`goal-card-${goal.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      goal.progress >= 100 ? 'bg-emerald-500/20' : 'bg-chart-4/20'
                    }`}>
                      {goal.progress >= 100 ? (
                        <Trophy className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Target className="w-5 h-5 text-chart-4" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{goal.name}</CardTitle>
                      {goal.deadline && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Prazo: {format(new Date(goal.deadline), "dd/MM/yyyy")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleEdit(goal)}
                      data-testid={`edit-goal-${goal.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(goal.id)}
                      className="text-destructive hover:text-destructive"
                      data-testid={`delete-goal-${goal.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-mono font-semibold">{goal.progress.toFixed(0)}%</span>
                  </div>
                  <Progress 
                    value={goal.progress} 
                    className="h-2"
                  />
                </div>
                
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs text-muted-foreground">Guardado</p>
                    <p className="font-mono font-semibold text-chart-4">
                      {formatCurrency(goal.current_amount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Meta</p>
                    <p className="font-mono font-semibold">
                      {formatCurrency(goal.target_amount)}
                    </p>
                  </div>
                </div>

                {goal.progress < 100 && (
                  <div className="pt-2 border-t border-border">
                    {addAmountId === goal.id ? (
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="Valor"
                          value={addAmount}
                          onChange={(e) => setAddAmount(e.target.value)}
                          className="flex-1"
                          data-testid={`add-amount-input-${goal.id}`}
                        />
                        <Button 
                          size="sm"
                          onClick={() => handleAddAmount(goal.id)}
                          data-testid={`confirm-add-amount-${goal.id}`}
                        >
                          Adicionar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => { setAddAmountId(null); setAddAmount(''); }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => setAddAmountId(goal.id)}
                        data-testid={`add-to-goal-${goal.id}`}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar valor
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="text-center py-12">
            <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma meta definida</p>
            <Button 
              variant="link" 
              onClick={() => setIsDialogOpen(true)}
              className="mt-2"
            >
              Criar primeira meta
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
