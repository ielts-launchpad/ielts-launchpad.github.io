import type { Interaction } from '@/engine/content/schema';
import { DragBank } from './DragBank';
import { InteractionGap } from './InteractionGap';
import { InteractionMulti } from './InteractionMulti';
import { InteractionSelect } from './InteractionSelect';
import { InteractionSingle } from './InteractionSingle';
import type { GroupProps } from './types';

const RENDERERS: Record<Interaction, (props: GroupProps) => React.JSX.Element> = {
  single: InteractionSingle,
  multi: InteractionMulti,
  select: InteractionSelect,
  gap: InteractionGap,
  dragBank: DragBank,
};

/** Render one question group: instructions plus the matching interaction. */
export function GroupView({ group, controller }: GroupProps): React.JSX.Element {
  const Renderer = RENDERERS[group.interaction];
  return (
    <section className="space-y-3" data-testid={`group-${group.id}`} data-interaction={group.interaction}>
      <p className="font-medium text-slate-700">{group.instructions}</p>
      <Renderer group={group} controller={controller} />
    </section>
  );
}
