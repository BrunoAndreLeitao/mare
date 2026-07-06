import { router } from 'expo-router';

import { SpotForm } from '../../components/SpotForm';
import { t } from '../../i18n';
import { useSpotsStore } from '../../stores/spotsStore';

export default function NewSpotScreen() {
  const createSpot = useSpotsStore((s) => s.create);
  const error = useSpotsStore((s) => s.error);

  return (
    <SpotForm
      submitLabel={t.spots.create}
      externalError={error}
      onSubmit={async (values) => {
        const spot = await createSpot({
          name: values.name,
          latitude: values.latitude,
          longitude: values.longitude,
          notes: values.notes ?? undefined,
        });
        if (spot !== null) {
          router.back();
        }
      }}
    />
  );
}
