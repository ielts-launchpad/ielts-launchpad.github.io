import { z } from 'zod';
import { qtypeSchema, type QType } from '../content/schema';

export const tipsSchema = z.array(z.object({
  qtype: qtypeSchema,
  text: z.string().trim().min(1),
}).strict()).superRefine((tips, context) => {
  const seen = new Set<QType>();
  tips.forEach((tip, index) => {
    if (seen.has(tip.qtype)) context.addIssue({ code: 'custom', path: [index, 'qtype'], message: 'Duplicate question type' });
    seen.add(tip.qtype);
  });
});

export type PracticeTip = z.infer<typeof tipsSchema>[number];

export function findTip(tips: readonly PracticeTip[], qtype: QType): string | null {
  return tips.find((tip) => tip.qtype === qtype)?.text ?? null;
}