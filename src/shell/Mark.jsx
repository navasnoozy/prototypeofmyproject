import { FlameIcon } from 'lucide-react';

// The placeholder mark of the product (record 36, point 8): a red rounded
// square with a white flame, until the product has a real name and logo.
export const Mark = () => (
  <span className="grid size-8 place-items-center rounded-lg bg-brand text-white" aria-hidden="true">
    <FlameIcon className="size-[18px]" />
  </span>
);
