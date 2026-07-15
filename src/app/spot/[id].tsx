import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { SpotForm } from '../../components/SpotForm';
import { t } from '../../i18n';
import { colors, font, space } from '../../theme';
import { useSpotsStore } from '../../stores/spotsStore';

export default function EditSpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const spot = useSpotsStore((s) => s.spots.find((x) => x.id === id));
  const updateSpot = useSpotsStore((s) => s.update);
  const archiveSpot = useSpotsStore((s) => s.archive);
  const error = useSpotsStore((s) => s.error);

  // Only reachable from the spots list, which loads the store on mount.
  if (spot === undefined) {
    return null;
  }

  function confirmArchive(spotId: string) {
    Alert.alert(t.common.archive, t.spots.archiveConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.common.archive,
        style: 'destructive',
        onPress: async () => {
          if (await archiveSpot(spotId)) {
            router.back();
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <SpotForm
        initial={{
          name: spot.name,
          latitude: spot.latitude,
          longitude: spot.longitude,
          notes: spot.notes,
        }}
        submitLabel={t.common.save}
        externalError={error}
        onSubmit={async (values) => {
          const updated = await updateSpot(spot.id, values);
          if (updated !== null) {
            router.back();
          }
        }}
      />
      <View style={styles.archive}>
        <Pressable onPress={() => confirmArchive(spot.id)} hitSlop={8}>
          <Text style={styles.archiveLabel}>{t.common.archive}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  archive: { padding: space.md, alignItems: 'center' },
  archiveLabel: {
    fontFamily: font.bodySemiBold,
    fontSize: 14,
    color: colors.error,
    textDecorationLine: 'underline',
  },
});
