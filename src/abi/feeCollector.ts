export const feeCollectorAbi = [
	{
		type: "receive",
		stateMutability: "payable",
	},
	{
		type: "function",
		name: "domainSeperator",
		inputs: [
			{
				name: "_chainID",
				type: "uint256",
				internalType: "uint256",
			},
		],
		outputs: [
			{
				name: "",
				type: "bytes32",
				internalType: "bytes32",
			},
		],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "exec",
		inputs: [
			{
				name: "userOps",
				type: "tuple[]",
				internalType: "struct ForwarderV2.UserOperation[]",
				components: [
					{
						name: "to",
						type: "address",
						internalType: "address",
					},
					{
						name: "amount",
						type: "uint256",
						internalType: "uint256",
					},
					{
						name: "data",
						type: "bytes",
						internalType: "bytes",
					},
				],
			},
			{
				name: "_signature",
				type: "bytes",
				internalType: "bytes",
			},
			{
				name: "from",
				type: "address",
				internalType: "address",
			},
		],
		outputs: [],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "getNonce",
		inputs: [
			{
				name: "from",
				type: "address",
				internalType: "address",
			},
		],
		outputs: [
			{
				name: "",
				type: "uint256",
				internalType: "uint256",
			},
		],
		stateMutability: "view",
	},
	{
		type: "event",
		name: "LogCall",
		inputs: [
			{
				name: "_contract",
				type: "address",
				indexed: true,
				internalType: "address",
			},
			{
				name: "_value",
				type: "uint256",
				indexed: false,
				internalType: "uint256",
			},
			{
				name: "_data",
				type: "bytes",
				indexed: false,
				internalType: "bytes",
			},
		],
		anonymous: false,
	},
	{
		type: "event",
		name: "LogReceivedEther",
		inputs: [
			{
				name: "_from",
				type: "address",
				indexed: true,
				internalType: "address",
			},
			{
				name: "_amount",
				type: "uint256",
				indexed: false,
				internalType: "uint256",
			},
		],
		anonymous: false,
	},
] as const;
