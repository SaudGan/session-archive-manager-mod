import type { ClientModule } from 'claude-code'

// Each session's ON/OFF control. On the terminal it draws a pill: orange with
// white "ON  ●" when the session is shown, dim gray with "●  OFF" when it is
// archived; the round border in the fill color gives the pill its corners. On
// the desktop it is an invisible click area (ghost) laid over the vector switch.
// A click posts { toggle: id } to the hooks module, which flips the wish.
type Props = { id: string; on: boolean; ghost?: boolean }
type State = { hot: boolean }

const Toggle: ClientModule<Props, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  if (surface.state === undefined) {
    surface.setState({ hot: false })
    surface.onPointer(e => {
      if (e.type === 'enter') {
        surface.setState({ hot: true })
        if (props.id === '__refresh__') surface.post({ hover: props.id, on: true })
      } else if (e.type === 'leave') {
        surface.setState({ hot: false })
        if (props.id === '__refresh__') surface.post({ hover: props.id, on: false })
      }
      else if (e.type === 'up' && (e.button ?? 'left') === 'left') surface.post({ toggle: props.id })
    })
  }
  const hot = surface.state?.hot === true
  // ghost: an invisible click area laid over the vector switch the desktop draws.
  if (props.ghost) return <Text> </Text>
  return props.on ? (
    <Box paddingX={1} borderStyle="round" borderColor={hot ? 'warning' : 'claude'} backgroundColor={hot ? 'warning' : 'claude'}>
      <Text color="#ffffff" weight="semibold">ON  ●</Text>
    </Box>
  ) : (
    <Box paddingX={1} borderStyle="round" borderColor="subtle" backgroundColor="subtle">
      <Text color={hot ? 'text' : 'inactive'} weight="semibold">●  OFF</Text>
    </Box>
  )
}

export default Toggle
