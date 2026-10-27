// Variant A: plain static import of the wrapper (expected to break prerender).
import { Button } from '@acmelabs/design-system-react/components/button'

export function DsButton() {
  return <Button variant="filled">Download</Button>
}
