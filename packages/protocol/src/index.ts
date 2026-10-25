/** UDP/TFTP ports used by Rane RPM devices. See docs/protocol.md. */
export const PORTS = {
  /** Device listens for discovery (`RA`, `RM`, `WI`) packets. */
  discoveryDevice: 5131,
  /** PC listens for discovery replies. */
  discoveryHost: 5132,
  /** Parameter read/write frames. */
  control: 5000,
  /** Whole-configuration transfer (file name `file`, mode `octet`). */
  tftp: 69,
} as const;

/** Size of every discovery packet in bytes. */
export const DISCOVERY_PACKET_SIZE = 82;

/** Size of every parameter frame in bytes. */
export const CONTROL_FRAME_SIZE = 905;
