import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Trash2, 
  RefreshCw, 
  ShieldCheck, 
  AlertCircle,
  Wallet,
  Coins,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PriceData {
  gold: {
    price_24k_toman: number;
    price_18k_toman: number;
    daily_change_percent: number;
  };
  silver: {
    price_toman: number;
    daily_change_percent: number;
  };
  meta: {
    source: 'live' | 'cached';
    last_updated: string;
  };
}

interface PortfolioItem {
  id: number;
  asset_type: 'gold_18k' | 'gold_24k' | 'silver';
  amount: number;
  purchase_price_toman: number;
}

export default function App() {
  const [prices, setPrices] = useState<PriceData | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Form State
  const [assetType, setAssetType] = useState<'gold_18k' | 'gold_24k' | 'silver'>('gold_18k');
  const [amount, setAmount] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');

  const fetchPrices = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/prices');
      const data = await res.json();
      setPrices(data);
    } catch (error) {
      console.error("Failed to fetch prices", error);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const fetchPortfolio = async () => {
    try {
      const res = await fetch('/api/portfolio');
      const data = await res.json();
      setPortfolio(data);
    } catch (error) {
      console.error("Failed to fetch portfolio", error);
    }
  };

  useEffect(() => {
    fetchPrices();
    fetchPortfolio();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  const addToPortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !purchasePrice) return;

    await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asset_type: assetType,
        amount: parseFloat(amount),
        purchase_price_toman: parseFloat(purchasePrice)
      })
    });

    setAmount('');
    setPurchasePrice('');
    fetchPortfolio();
  };

  const removeFromPortfolio = async (id: number) => {
    await fetch(`/api/portfolio/${id}`, { method: 'DELETE' });
    fetchPortfolio();
  };

  const calculatePortfolioStats = () => {
    if (!prices || !portfolio.length) return { totalValue: 0, netProfit: 0, returnPercent: 0 };

    let totalValue = 0;
    let totalCost = 0;

    portfolio.forEach(item => {
      let currentPrice = 0;
      if (item.asset_type === 'gold_18k') currentPrice = prices.gold.price_18k_toman;
      else if (item.asset_type === 'gold_24k') currentPrice = prices.gold.price_24k_toman;
      else if (item.asset_type === 'silver') currentPrice = prices.silver.price_toman;

      const currentValue = item.amount * currentPrice;
      const cost = item.amount * item.purchase_price_toman;
      
      // Apply 1% commission on exit (as per requirement)
      totalValue += currentValue * 0.99;
      totalCost += cost;
    });

    const netProfit = totalValue - totalCost;
    const returnPercent = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

    return { totalValue, netProfit, returnPercent };
  };

  const stats = calculatePortfolioStats();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-gray-500 font-medium">در حال دریافت اطلاعات بازار...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-gray-900 p-4 md:p-8 font-sans" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">داشبورد طلا و نقره</h1>
            <div className="flex items-center gap-2 mt-2">
              {prices?.meta.source === 'live' ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                  <ShieldCheck className="w-3 h-3" />
                  وضعیت: زنده
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                  <AlertCircle className="w-3 h-3" />
                  وضعیت: کش (آفلاین)
                </span>
              )}
              <span className="text-xs text-gray-400">
                آخرین بروزرسانی: {new Date(prices?.meta.last_updated || '').toLocaleTimeString('fa-IR')}
              </span>
            </div>
          </div>
          <button 
            onClick={fetchPrices}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl shadow-sm hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">بروزرسانی دستی</span>
          </button>
        </header>

        {/* Price Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PriceCard 
            title="طلای ۱۸ عیار" 
            price={prices?.gold.price_18k_toman || 0} 
            change={prices?.gold.daily_change_percent || 0}
            unit="گرم"
            icon={<Coins className="text-amber-500" />}
          />
          <PriceCard 
            title="طلای ۲۴ عیار" 
            price={prices?.gold.price_24k_toman || 0} 
            change={prices?.gold.daily_change_percent || 0}
            unit="گرم"
            icon={<Coins className="text-yellow-600" />}
          />
          <PriceCard 
            title="نقره" 
            price={prices?.silver.price_toman || 0} 
            change={prices?.silver.daily_change_percent || 0}
            unit="گرم"
            icon={<Coins className="text-slate-400" />}
          />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Portfolio Summary & Form */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Portfolio Stats */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">ارزش کل پرتفو</p>
                <p className="text-2xl font-bold">{stats.totalValue.toLocaleString('fa-IR')} <span className="text-sm font-normal text-gray-400">تومان</span></p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">سود/ضرر خالص</p>
                <p className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {Math.abs(stats.netProfit).toLocaleString('fa-IR')} 
                  <span className="text-sm font-normal opacity-70 mr-1">تومان</span>
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">بازدهی کل</p>
                <div className={`flex items-center gap-1 text-2xl font-bold ${stats.returnPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {stats.returnPercent >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  {Math.abs(stats.returnPercent).toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Portfolio List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-bottom border-gray-50 flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-indigo-600" />
                  دارایی‌های من
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-gray-50 text-gray-400 text-xs font-bold uppercase">
                      <th className="px-6 py-4">نوع دارایی</th>
                      <th className="px-6 py-4">مقدار (گرم)</th>
                      <th className="px-6 py-4">قیمت خرید</th>
                      <th className="px-6 py-4">سود/ضرر</th>
                      <th className="px-6 py-4">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    <AnimatePresence mode="popLayout">
                      {portfolio.map((item) => {
                        let currentPrice = 0;
                        if (item.asset_type === 'gold_18k') currentPrice = prices?.gold.price_18k_toman || 0;
                        else if (item.asset_type === 'gold_24k') currentPrice = prices?.gold.price_24k_toman || 0;
                        else if (item.asset_type === 'silver') currentPrice = prices?.silver.price_toman || 0;

                        const profit = (currentPrice * item.amount * 0.99) - (item.purchase_price_toman * item.amount);
                        
                        return (
                          <motion.tr 
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-6 py-4 font-medium">
                              {item.asset_type === 'gold_18k' ? 'طلای ۱۸ عیار' : 
                               item.asset_type === 'gold_24k' ? 'طلای ۲۴ عیار' : 'نقره'}
                            </td>
                            <td className="px-6 py-4 font-mono">{item.amount.toLocaleString('fa-IR')}</td>
                            <td className="px-6 py-4 font-mono">{item.purchase_price_toman.toLocaleString('fa-IR')}</td>
                            <td className={`px-6 py-4 font-mono font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {profit >= 0 ? '+' : ''}{profit.toLocaleString('fa-IR')}
                            </td>
                            <td className="px-6 py-4">
                              <button 
                                onClick={() => removeFromPortfolio(item.id)}
                                className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                    {portfolio.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                          هنوز هیچ دارایی ثبت نکرده‌اید.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Add Asset Form */}
          <aside className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                افزودن دارایی جدید
              </h2>
              <form onSubmit={addToPortfolio} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase">نوع دارایی</label>
                  <select 
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="gold_18k">طلای ۱۸ عیار</option>
                    <option value="gold_24k">طلای ۲۴ عیار</option>
                    <option value="silver">نقره</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase">مقدار (گرم)</label>
                  <input 
                    type="number" 
                    step="0.001"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="مثلا: ۵.۵"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-400 uppercase">قیمت خرید (تومان)</label>
                  <input 
                    type="number" 
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="قیمت هر گرم به تومان"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl shadow-lg shadow-gray-200 hover:bg-gray-800 active:scale-[0.98] transition-all mt-4"
                >
                  ثبت در پرتفو
                </button>
              </form>
            </div>

            {/* Info Card */}
            <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/20 rounded-lg">
                  <History className="w-5 h-5" />
                </div>
                <h3 className="font-bold">نکته محاسباتی</h3>
              </div>
              <p className="text-sm text-indigo-100 leading-relaxed">
                در محاسبات سود و زیان، ۱٪ کارمزد فروش به صورت خودکار از ارزش فعلی دارایی‌های شما کسر شده است تا رقم خالص دریافتی را مشاهده کنید.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function PriceCard({ title, price, change, unit, icon }: { title: string, price: number, change: number, unit: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4 relative overflow-hidden group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-gray-100 transition-colors">
            {icon}
          </div>
          <h3 className="font-bold text-gray-500">{title}</h3>
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${change >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
          {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(change)}%
        </div>
      </div>
      <div>
        <p className="text-3xl font-black tracking-tight">
          {price.toLocaleString('fa-IR')}
          <span className="text-sm font-medium text-gray-400 mr-2">تومان / {unit}</span>
        </p>
      </div>
      <div className="absolute -bottom-4 -right-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
        {React.cloneElement(icon as React.ReactElement, { size: 100 })}
      </div>
    </div>
  );
}
