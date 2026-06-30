import RichTextEditor from '../../RichTextEditor';
import type { ContentBlock } from '../../../types/lessonContent';

type Props = {
  block: ContentBlock;
  onChange: (patch: Partial<ContentBlock>) => void;
};

export default function TextBlockEditor({ block, onChange }: Props) {
  return (
    <RichTextEditor
      content={block.html}
      onChange={(html) => onChange({ html })}
      placeholder="Schreibe hier den Text dieser Lektion …"
      minHeight={240}
    />
  );
}
