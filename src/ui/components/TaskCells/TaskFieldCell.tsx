import { LinkedText } from './LinkedText'

// The value of an inline field such as `[type:: work]`, as it reads in the note.
// A link in it opens on a click; a click beside the link edits the value.
export const TaskFieldCell = ({ value }: { value: string | undefined }) =>
  value ? (
    // The padding leaves room for a link's focus ring, which the truncation would cut.
    <span className='-m-0.5 block truncate p-0.5'>
      <LinkedText text={value} />
    </span>
  ) : null
