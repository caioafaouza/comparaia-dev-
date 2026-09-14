require('dotenv').config();
const mercadoPagoService = require('./services/mercadoPagoService');

(async () => {
  try {
    const pkg = [{
      id: 'pkg_pro',
      title: 'Plano Pro 1K',
      description: 'Pacote de 1000 tokens',
      unit_price: 19.90,
      quantity: 1
    }];
    const orderData = {
      tenantId: '6e8aa91a-8982-42d8-a11e-e39a02aa6014',
      userId: 'test_user',
      userEmail: 'qa-e2e@test.com'
    };
    const orderId = 'test_order_123';
    
    console.log('Testing createPreference...');
    const result = await mercadoPagoService.createPreference(pkg, orderData, orderId);
    console.log('Success:', result);
  } catch (error) {
    console.error('MP ERROR CAUGHT:');
    console.error(error);
    if(error.cause) console.error('Cause:', error.cause);
  }
})();
