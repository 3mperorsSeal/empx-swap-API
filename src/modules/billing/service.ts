import quotaService from "../../services/quotaService";

export async function grantMonthlyCreditsForApiKey(
  apiKeyId: number | null,
  userId: number | null,
  credits: number,
) {
  // Thin wrapper to add monthly credits
  return quotaService.addMonthlyCredits({ apiKeyId, userId, credits });
}

export default { grantMonthlyCreditsForApiKey };
