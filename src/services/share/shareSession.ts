import * as Sharing from 'expo-sharing';
import { type RefObject } from 'react';
import { type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

// A única fronteira intestável (nativo). captureRef → PNG no cache →
// shareAsync. Falhar aqui NÃO parte nada: o utilizador cancelar o share sheet
// é estado normal, como o fetch de condições falhar (CLAUDE.md).
export async function shareSession(ref: RefObject<View | null>): Promise<void> {
  try {
    // Densidade: sem width/height a captura sai à densidade nativa do ecrã
    // (340pt × scale — verificado no emulador: 892px @2.625x). É o máximo de
    // nitidez real: no 5.1.0 `width` sozinho é ignorado (o scale no Android
    // exige width E height, ViewShot.java:800) e forçar um tamanho acima da
    // densidade nativa seria upscale. mimeType explícito: o default nem
    // sempre é reconhecido pelo share sheet do Android.
    const uri = await captureRef(ref, { format: 'png', quality: 1 });
    await Sharing.shareAsync(uri, { mimeType: 'image/png' });
  } catch (e) {
    console.warn('[share] sessão:', e);
  }
}
