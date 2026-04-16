export interface LightboxState {
  open: boolean;
  src: string;
  caption: string;
}

export interface ImageLightboxProps {
  open: boolean;
  src: string;
  caption: string;
  onClose: () => void;
}
