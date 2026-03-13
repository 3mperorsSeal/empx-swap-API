/**
 * Per-chain adapter registry
 *
 * Adapter addresses are inlined from dex-agg-reference/config/adapters/*.json.
 * Each adapter implements the IAdapter interface:
 *   query(amountIn, tokenIn, tokenOut) → amountOut
 *
 * These are passed to the EmpsealRouter constructor and stored
 * in its ADAPTERS[] array; the router's findBestPath / queryNoSplit
 * functions iterate over them on-chain.
 */

export interface AdapterInfo {
    name: string;
    address: `0x${string}`;
}

export const CHAIN_ADAPTERS: Record<number, AdapterInfo[]> = {
    // ── PulseChain (369) ────────────────────────────────────────────────────
    369: [
        { name: "PulsexV2", address: "0x842e05D2cAF940B25d7B7Db291ABDc88748d7F90" },
        { name: "PulsexV1", address: "0xa5ab0aF6eE886770B31Fb9350f7FC8F433dC2C59" },
        { name: "9MM", address: "0xb6a9140DaeBE265708785B093C0Ef561eEf26159" },
        { name: "9Inch", address: "0x0F1cffE422EF2C85f5983Fb0B015c781BAb8A74f" },
        { name: "Dextop", address: "0x34FD3c37c2A40e925744e102d2Cae83635CC64C3" },
        { name: "Sparkswap", address: "0x6AeC9Ab81A6D66Cae61B1F11c9A5c3d06020bfCB" },
        { name: "9MMV3", address: "0x8fb6314678a9287f9B47B96e54122444e43dDE1F" },
        { name: "9InchV3", address: "0x0f5416Efd26E2EbFAB6DdCcD58859B6cfD7Df556" },
        { name: "UniswapV3", address: "0xcfE09D7f35131DAfebD12356C4f52b17f65Da2E5" },
        { name: "EmpXStable", address: "0xf586000c24e2b640a0478dcf51de856df5e3328a" },
        { name: "PhuxV2", address: "0x5fdd3f245ae060953dcC3C89Da8Dd4c6c26629c0" },
    ],

    // ── EthereumPoW (10001) ─────────────────────────────────────────────────
    10001: [
        { name: "LFGswap", address: "0x2f21ff788e14a531847e6658afbd725555757da5" },
        { name: "UniswapV2", address: "0xc14441CBD763FBad2Db823CCa77AFAdeCbcdd0c4" },
        { name: "PoWSwap", address: "0x1FB42F76F101F8EB2ed7a12aC16b028500907F80" },
        { name: "UniswapV3", address: "0xcd05ae7369e14d0fd232f0d3c025d9703b779d80" },
    ],

    // ── Sonic (146) ─────────────────────────────────────────────────────────
    146: [
        { name: "ShadowV2", address: "0x1FB42F76F101F8EB2ed7a12aC16b028500907F80" },
        { name: "ShadowV3", address: "0x3Ad3e05fA6ea10053D1da2B95a8b4b6672d3b933" },
        { name: "SwapxV2", address: "0xc1Bb27E7AE8af9164Cb6B5D3A465478415EdEbB7" },
        { name: "WagmiV3", address: "0x12dA769027A9A6121eB176346697d81Ff6673a22" },
        { name: "MetropolisV2", address: "0xE15F3Eb9475C513593EAC49a8AF066B71e268556" },
        { name: "MetropolisLB", address: "0xce032ac88ad11E6f8374B3760F5a98a77c6584f0" },
        { name: "EqualizerV2", address: "0xcD05Ae7369e14D0Fd232F0D3C025D9703B779d80" },
        { name: "SpookySwapV2", address: "0xe40c877e06095417557C3bB874F4e2e8D08f11Fd" },
        { name: "SpookySwapV3", address: "0x6ce282f748514df878c396d3d1a024bd5bb26871" },
        { name: "OkuTrade", address: "0xE18947547EB1f49B725c3Ca4f95bD45A84F6c24A" },
        { name: "9MMV2", address: "0x86B1b88B2BBFe49999fA9A415270997ed1Bfd803" },
        { name: "9MMV3", address: "0xB7e18d1ddc55D5c0748573AC97519F7b309aaA1B" },
        { name: "CurveUSDC/SCUSD", address: "0x2fdd76fC5A8F6081E059DF76756E347f6B8278d8" },
        { name: "CurvescUSD/frxUSD", address: "0x94b9E87E90223925fE92AaAcf255f3b405e78a19" },
        { name: "CurvescETH/frxETH", address: "0x88fe52B16d005a437DC29Ee43e34fD623660D77F" },
        { name: "CurvescETH/WETH", address: "0x6b7c81207240a38e03e5e9b138c53c4762515ccd" },
    ],

    // ── Base (8453) ──────────────────────────────────────────────────────────
    8453: [
        { name: "UniV3", address: "0xBfC918572B5a819194875568dAF67aeF7ADA8437" },
        { name: "UniV2", address: "0xb0345e6AA593961fBD3C7194E5dBF79ca7e42C43" },
        { name: "AerodromeV2", address: "0x82064ec0119E776dc1751E104Cc603A347861e22" },
        { name: "Aerodrome", address: "0xca9b4b3a861ebb3475263c8cd5943c8ab7403ba1" },
        { name: "PancakeV2", address: "0x9e0f316d883CB71c63865A3DD8D1566E15eaBAeB" },
        { name: "PancakeV3", address: "0x2E8E19b402460c859B6E07a71b29b01c8C5A420F" },
        { name: "SushiV2", address: "0x24B4d249eb21fbD224E881be98334a21855914dA" },
        { name: "SushiV3", address: "0x19BBE0f501251aC16Fcc72cc9AF8678Fc6AAC594" },
        { name: "AlienBaseV2", address: "0xe7416340942F1DaD79f193a10794A2deA219E833" },
        { name: "AlienBaseV3", address: "0xAe0A08182A8b9652695804e8F92f4D4b8A1FD798" },
        { name: "BaseSwapV2", address: "0x43A13238F6f1610d249947aec3E051B7dD378Dbb" },
        { name: "BaseSwapV3", address: "0x7A6Fc08501B413106e30822a8716A51e1cCE5487" },
        { name: "SwapBasedV2", address: "0x9c23860d40e22e694f0CE68E022db0F1f919A19d" },
        { name: "SwapBasedV3", address: "0xa14Cc33814ba6A5F7a9bc69452302DdF7C4513AC" },
        { name: "9MMV2", address: "0xB49536173f268e1d27d2Cc50ADa973527308729D" },
        { name: "9MMV3", address: "0x43FBC0d0F6392689801168b08A7444550647caae" },
        { name: "DackieSwapV3", address: "0xB8169A3c71D49433D2d9650E1E180519042390f5" },
        { name: "CurveFourPool", address: "0x8e94D6Afb1A40090a2e7C5870F7A6a06b4740069" },
        { name: "HydrexIntegral", address: "0xbEE48badaEB4E5fd71818796603fe063C3cA233D" },
        { name: "BalancerV2", address: "0x57f1AFFbc2d8b8445857D7813cD826ec71Ff86d9" },
    ],

    // ── Sei (1329) ───────────────────────────────────────────────────────────
    1329: [
        { name: "SaphyreV1", address: "0x93ae3552B154431316F6160d07C3f7204b44f1cF" },
        { name: "SaphyreV2", address: "0x1E965F231380986e11E989beEbe864Ae41881D69" },
        { name: "OkuTradeV3", address: "0xee4AB587A566675Afad2D5Cd7703096982cC1FE5" },
        { name: "Sailor", address: "0xEab30C23A015942BDc8204bD8dcA2780a5957a8c" },
        { name: "YakaFinance", address: "0xA285098184932DA9AAa8F8B4895B93FdeeeC07a2" },
    ],

    // ── Berachain (80094) ────────────────────────────────────────────────────
    80094: [
        { name: "KodiakV3", address: "0xcD05Ae7369e14D0Fd232F0D3C025D9703B779d80" },
        { name: "KodiakV2", address: "0x2F21FF788e14A531847E6658aFBD725555757da5" },
        { name: "Bulla", address: "0xc1Bb27E7AE8af9164Cb6B5D3A465478415EdEbB7" },
        { name: "BeraSwap", address: "0x6cE282F748514Df878C396d3d1a024BD5Bb26871" },
        { name: "WinnieSwap", address: "0xce032ac88ad11E6f8374B3760F5a98a77c6584f0" },
    ],

    // ── Rootstock (30) ───────────────────────────────────────────────────────
    30: [
        { name: "OkuTrade", address: "0xc14441CBD763FBad2Db823CCa77AFAdeCbcdd0c4" },
        { name: "SushiswapV3", address: "0xe40c877e06095417557C3bB874F4e2e8D08f11Fd" },
    ],
};

/**
 * Get the adapter list for a chain.
 * Returns an empty array for unknown chains.
 */
export function getAdapters(chainId: number): AdapterInfo[] {
    return CHAIN_ADAPTERS[chainId] ?? [];
}

/**
 * Get a flat list of just the adapter addresses for a chain.
 */
export function getAdapterAddresses(chainId: number): `0x${string}`[] {
    return getAdapters(chainId).map((a) => a.address);
}
