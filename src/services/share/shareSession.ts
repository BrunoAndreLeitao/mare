import * as Sharing from 'expo-sharing';
import { type RefObject } from 'react';
import { type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

// A única fronteira intestável (nativo). captureRef → PNG no cache →
// shareAsync. Falhar aqui NÃO parte nada: o utilizador cancelar o share sheet
// é estado normal, como o fetch de condições falhar (CLAUDE.md).
export async function shareSession(ref: RefObject<View | null>): Promise<void> {
  try {
    // Densidade: o react-native-view-shot@5.1.0 NÃO tem `pixelRatio` — esta
    // versão controla a resolução do output por `width`. O ShareCard mede
    // 340pt de largura; capturamos a 1020 (3×) e a altura escala pelo rácio,
    // mantendo o cartão nítido sem fixar uma altura que varia com o estado
    // (pending não tem hero). mimeType explícito: o default nem sempre é
    // reconhecido pelo share sheet do Android.
    const uri = await captureRef(ref, { format: 'png', quality: 1, width: 1020 });
    await Sharing.shareAsync(uri, { mimeType: 'image/png' });
  } catch (e) {
    console.warn('[share] sessão:', e);
  }
}
