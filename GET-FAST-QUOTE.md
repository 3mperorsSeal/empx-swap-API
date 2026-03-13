Request: 
http://localhost:3000/v1/quotes/369/fast?sellToken=0xA1077a294dDE1B09bB078844df40758a5D0f9a27&buyToken=0x95B303987A60C71504D99Aa1b13B4DA07b0790ab&sellAmount=5000000000000000000000

Response:
{
  "requestId": "2e3889a6-030f-4c21-a0ff-7a281edeeb0e",
  "amountIn": "5000000000000000000000",
  "amountOut": "7387333321897488853552",
  "amountOutMin": "7350396655288001409284",
  "route": {
    "type": "NOSPLIT",
    "path": [
      "0xA1077a294dDE1B09bB078844df40758a5D0f9a27",
      "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39",
      "0xb17D901469B9208B17d916112988A3FeD19b5cA1",
      "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab"
    ],
    "adapters": [
      "0x842e05D2cAF940B25d7B7Db291ABDc88748d7F90",
      "0x842e05D2cAF940B25d7B7Db291ABDc88748d7F90",
      "0x842e05D2cAF940B25d7B7Db291ABDc88748d7F90"
    ]
  },
  "priceImpact": 0,
  "meta": {
    "quotedAt": 1772725496,
    "chainId": 369,
    "computationTime": 2437
  },
  "strategyUsed": "fast"
}

___________________________________________________________________________

{
  "requestId": "448a5968-39eb-4f2c-93c2-6ddeffa40b4f",
  "amountIn": "5000000000000000000000",
  "amountOut": "7140219557827606597778",
  "amountOutMin": "7104518460038468564789",
  "route": {
    "type": "NOSPLIT",
    "path": [
      "0xA1077a294dDE1B09bB078844df40758a5D0f9a27",
      "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39",
      "0x0Cb6F5a34ad42ec934882A05265A7d5F59b51A2f",
      "0x95B303987A60C71504D99Aa1b13B4DA07b0790ab"
    ],
    "adapters": [
      "0x8fb6314678a9287f9B47B96e54122444e43dDE1F",
      "0xa5ab0aF6eE886770B31Fb9350f7FC8F433dC2C59",
      "0x842e05D2cAF940B25d7B7Db291ABDc88748d7F90"
    ]
  },
  "priceImpact": 0,
  "meta": {
    "quotedAt": 1773239914,
    "chainId": 369,
    "computationTime": 978
  },
  "strategyUsed": "fast"
}