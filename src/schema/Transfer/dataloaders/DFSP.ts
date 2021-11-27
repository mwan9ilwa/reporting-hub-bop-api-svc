/**************************************************************************
 *  (C) Copyright Mojaloop Foundation 2020                                *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       Yevhen Kyriukha <yevhen.kyriukha@modusbox.com>                   *
 **************************************************************************/

import { Context } from '@app/context';
import DataLoader from 'dataloader';

type DFSPType = 'PAYER_DFSP' | 'PAYEE_DFSP';

const ID = (type: DFSPType) => Symbol.for(`DFSP_DL_${type}`);

const findDfsps = async (ctx: Context, transferIds: string[], type: DFSPType) => {
  const dfsps = await ctx.centralLedger.participant.findMany({
    where: {
      participantCurrency: {
        some: {
          transferParticipant: {
            some: {
              transferId: { in: transferIds },
              transferParticipantRoleType: { name: type },
            },
          },
        },
      },
    },
    include: {
      participantCurrency: {
        select: {
          transferParticipant: {
            select: {
              transferId: true,
            },
          },
        },
      },
    },
  });
  return Object.fromEntries(
    dfsps.map((e) => [
      e.participantCurrency[0].transferParticipant[0].transferId,
      {
        id: e.participantId,
        name: e.name,
        description: e.description,
        active: e.isActive,
      },
    ])
  );
};

export const getDFSPDataloader = (ctx: Context, dfspType: DFSPType) => {
  const { loaders } = ctx;

  // initialize DataLoader for getting payers by transfer IDs
  let dl = loaders.get(ID(dfspType));
  if (!dl) {
    dl = new DataLoader(async (transferIds: readonly string[]) => {
      // Get DFSP by Transfer IDs
      const dfsps = await findDfsps(ctx, transferIds as string[], dfspType);
      // IMPORTANT: sort data in the same order as transferIds
      return transferIds.map((id) => dfsps[id]);
    });
    // Put instance of dataloader in WeakMap for future reuse
    loaders.set(ID(dfspType), dl);
  }
  return dl;
};
