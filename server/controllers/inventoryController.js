
/**
 * InventoryController: Inteligência analítica sobre o estoque do tenant.
 */
const getProductIntelligence = async (req, res) => {
  const { productId } = req.params;
  const db = req.db;

  try {
    const product = await db('products').where({ id: productId }).first();
    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });

    // Cálculo de Custo Médio Ponderado (Somente entradas no banco isolado)
    const stats = await db('stock_movements')
      .where({ product_id: productId, type: 'INPUT' })
      .select(
        db.raw('SUM(unit_cost * quantity) / SUM(quantity) as avg_cost'),
        db.raw('MAX(unit_cost) as last_buy')
      )
      .first();

    const averageCost = stats.avg_cost || product.initial_cost;
    
    // Sugestão de Preço Técnico (Margem alvo de 35%)
    const suggestedPrice = averageCost * 1.35;

    res.json({
      name: product.name,
      average_cost: averageCost,
      last_acquisition: stats.last_buy || product.initial_cost,
      suggested_price: suggestedPrice,
      stock_health: product.stock_quantity > product.min_stock ? 'OK' : 'CRITICAL'
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao processar inteligência de produto.' });
  }
};

module.exports = { getProductIntelligence };
