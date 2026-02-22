import { Prisma } from "../../../generated/prisma/client";
import { AppError } from "../../core/errors";
import prisma from "../../lib/prisma";

type PartnerInput = {
  company_name?: string;
  website?: string | null;
  wallet_address?: string;
};

export const listPartners = async () => {
  return prisma.partners.findMany({
    orderBy: { created_at: "desc" },
  });
};

export const getPartnerById = async (id: string) => {
  return prisma.partners.findUnique({
    where: { id },
  });
};

// Check if wallet address already exists
export const checkWalletExists = async (
  walletAddress: string,
): Promise<boolean> => {
  const count = await prisma.partners.count({
    where: { wallet_address: walletAddress },
  });
  return count > 0;
};

export const createPartner = async (data: PartnerInput) => {
  try {
    // Check for duplicate wallet address
    const exists = await checkWalletExists(data.wallet_address!);
    if (exists) {
      throw new AppError(
        "wallet_address_exists",
        "Wallet address already exists",
        409,
      );
    }

    return prisma.partners.create({
      data: {
        company_name: data.company_name!,
        website: data.website,
        wallet_address: data.wallet_address!,
      },
    });
  } catch (error: any) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        "wallet_address_exists",
        "Wallet address already exists",
        409,
      );
    }
    throw error;
  }
};

export const updatePartner = async (id: string, data: PartnerInput) => {
  try {
    // If updating wallet address, check if new address already exists (excluding current partner)
    if (data.wallet_address) {
      const existing = await prisma.partners.findFirst({
        where: {
          wallet_address: data.wallet_address,
          id: { not: id },
        },
      });
      if (existing) {
        throw new AppError(
          "wallet_address_exists",
          "Wallet address already exists",
          409,
        );
      }
    }

    return prisma.partners.update({
      where: { id },
      data: {
        company_name: data.company_name || undefined,
        website: data.website,
        wallet_address: data.wallet_address || undefined,
        updated_at: new Date(),
      },
    });
  } catch (error: any) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return null;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        "wallet_address_exists",
        "Wallet address already exists",
        409,
      );
    }
    throw error;
  }
};

export const deletePartner = async (id: string) => {
  try {
    await prisma.partners.delete({
      where: { id },
    });
  } catch (error: any) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw AppError.NotFound("partner_not_found", "Partner not found");
    }
    throw error;
  }
};
