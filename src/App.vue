<script setup>
import { Suspense } from 'vue'
import { RouterView } from 'vue-router'

</script>

<template>
  
  <Suspense>
   <template #default>
    <RouterView />
   </template>
   <template #fallback>
     <span>Loading...</span>
   </template>
 </Suspense>

</template>

<style scoped> 
</style>
