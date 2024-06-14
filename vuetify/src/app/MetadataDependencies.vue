<template>
  <v-app>
    <v-main>
      <v-overlay v-model="loading" class="align-center justify-center">
        <v-progress-circular
          color="primary"
          size="64"
          indeterminate
        ></v-progress-circular>
      </v-overlay>

      <v-container fluid>
        <h1 class="mb-2">Metadata dependencies analyzer</h1>

        <v-radio-group
          v-model="method"
          label="Analysis method"
          inline
          hide-details
        >
          <v-radio label="Used location" value="usage"></v-radio>
          <v-radio label="References" value="references"></v-radio>
        </v-radio-group>
        <v-checkbox v-model="recursive" label="recursive"></v-checkbox>

        <v-autocomplete
          v-model="selectedType"
          label="Component Type"
          :items="types"
          clearable
        ></v-autocomplete>

        <v-autocomplete
          v-model="selectedComponent"
          label="Component Name"
          :items="names"
          item-title="fullName"
          clearable
          return-object
        ></v-autocomplete>

        <v-data-table :headers="headers" :items="metadatas" :search="search">
          <template #top>
            <v-toolbar color="white" flat>
              <v-toolbar-title>Metadata dependencies</v-toolbar-title>
              <v-spacer></v-spacer>
              <v-text-field
                v-model="search"
                append-inner-icon="mdi-magnify"
                label="Search"
                hide-details
                variant="outlined"
                density="compact"
              ></v-text-field>
              <v-btn
                prepend-icon="mdi-file-download"
                :href="metadataPath && metadataPath + '&format=xml'"
                :disabled="!metadataPath"
                :download="
                  selectedComponent ? selectedComponent.fullName + '.xml' : null
                "
                >package.xml</v-btn
              >
              <v-btn
                prepend-icon="mdi-file-download"
                :href="metadataPath && metadataPath + '&format=csv'"
                :disabled="!metadataPath"
                :download="
                  selectedComponent ? selectedComponent.fullName + '.csv' : null
                "
                >csv</v-btn
              >
            </v-toolbar>
          </template>
        </v-data-table>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, watch, watchEffect } from 'vue';

const loading = ref(false);
const method = ref('usage');
const recursive = ref(false);
const selectedType = ref(null);
const types = ref([]);
const selectedComponent = ref(null);
const names = ref([]);
const search = ref(null);

const headers = [
  { title: 'Name', key: 'fullName' },
  { title: 'Type', key: 'type' },
];
const metadatas = ref([]);
const metadataPath = ref(null);

function requestGet(path: string) {
  loading.value = true;
  return fetch(path)
    .then((r) => r.json())
    .finally(() => (loading.value = false));
}

watch(selectedType, async (newValue) => {
  selectedComponent.value = null;
  names.value = newValue ? await requestGet(`/api/metadata/${newValue}`) : [];
});
watchEffect(async () => {
  if (!selectedType.value || !selectedComponent.value || !method.value) {
    metadataPath.value = null;
    metadatas.value = [];
    return;
  }

  metadataPath.value = `/api/metadata/${method.value}/${selectedType.value}/${selectedComponent.value.id}?recursive=${recursive.value}`;
  metadatas.value = await requestGet(metadataPath.value);
});

requestGet('/api/metadata').then((res) => (types.value = res));
</script>
