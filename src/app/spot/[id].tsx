import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Button, StyleSheet, View } from 'react-native';

import { SpotForm } from '../../components/SpotForm';
import { t } from '../../i18n';
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
        <Button
          title={t.common.archive}
          color="#c0392b"
          onPress={() => confirmArchive(spot.id)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  archive: { padding: 16 },
});
