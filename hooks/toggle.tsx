import type { ClientModule } from 'claude-code'

// The ON/OFF pill drawn in each session's card, as in the preview picture:
// a filled orange pill with white "ON  ●" when the session is shown, a dim
// gray pill with "●  OFF" when it is archived. A click posts { toggle: id }
// to the hooks module, which flips the wish; the next props redraw the pill.
type Props = { id: string; on: boolean }
type State = { hot: boolean }

const Toggle: ClientModule<Props, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  if (surface.state === undefined) {
    surface.setState({ hot: false })
    surface.onPointer(e => {
      if (e.type === 'enter') surface.setState({ hot: true })
      else if (e.type === 'leave') surface.setState({ hot: false })
      else if (e.type === 'up' && (e.button ?? 'left') === 'left') surface.post({ toggle: props.id })
    })
  }
  const hot = surface.state?.hot === true
  return props.on ? (
    <Box paddingX={1} backgroundColor={hot ? 'warning' : 'claude'}>
      <Text color="#ffffff" weight="semibold">ON  ●</Text>
    </Box>
  ) : (
    <Box paddingX={1} backgroundColor="subtle">
      <Text color={hot ? 'text' : 'inactive'} weight="semibold">●  OFF</Text>
    </Box>
  )
}

export default Toggle
