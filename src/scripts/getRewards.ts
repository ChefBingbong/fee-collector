function calculateVolatility(prices: number[]): number {
	const meanPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
	// biome-ignore lint/style/useExponentiationOperator: <explanation>
	const variance = prices.reduce((sum, price) => sum + Math.pow(price - meanPrice, 2), 0) / prices.length;

	return Math.sqrt(variance);
}

console.log(calculateVolatility([10.8]));
