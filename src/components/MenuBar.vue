<script setup>
import { inject, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useUserData } from '../composables/loggedInUserData.js'

const apiURL = inject('apiURL')
const loggedInUserData = useUserData()

async function currentUser(){
  const response = await fetch(apiURL+'/api/user', {
        method: "GET", 
        mode: "cors", 
        cache: "no-cache",
        credentials: "include", 
        redirect: "follow", 
        referrerPolicy: "no-referrer", 
    });
  var respJson = await response.json()
  console.log(respJson)
  return respJson
}

onMounted(async()=>{
  var userData = await currentUser()
  if(userData.email && userData.username){
    loggedInUserData.value.email = userData.email
    loggedInUserData.value.username = userData.username
  }
  else{
    loggedInUserData.value.email = null
    loggedInUserData.value.username = null
  }
  
})

</script>

<template>
<nav class="navbar navbar-expand-sm navbar-expand-xs navbar-light bg-light rounded">
    <RouterLink class="navbar-brand" to="/">AgileShare</RouterLink>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarsExample09" aria-controls="navbarsExample09" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>

    <div class="collapse navbar-collapse" id="navbarsExample09">
      <ul class="navbar-nav mr-auto">

        <li class="nav-item" v-if="loggedInUserData.email && loggedInUserData.username"> 
          <RouterLink class="nav-link" to="/my-files">Moje pliki</RouterLink>
        </li>

        <!-- <li class="nav-item">
          <a class="nav-link disabled" href="#" tabindex="-1" aria-disabled="true">Disabled</a>
        </li> -->

        <li class="nav-item dropdown">
          <a class="nav-link dropdown-toggle" href="#" id="dropdown_button" data-bs-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
            <span v-if="loggedInUserData.email && loggedInUserData.username">{{ loggedInUserData.username }}</span>
            <span v-else>Wylogowany</span>
          </a>
          <div class="dropdown-menu" aria-labelledby="dropdown_button">
            
            <RouterLink v-if="loggedInUserData.email && loggedInUserData.username" class="dropdown-item" to="/account">Konto</RouterLink>
            <RouterLink v-if="loggedInUserData.email && loggedInUserData.username" class="dropdown-item" to="/logout">Wyloguj się</RouterLink>

            <RouterLink v-if="!loggedInUserData.email || !loggedInUserData.username" class="dropdown-item" to="/login">Zaloguj się</RouterLink>
            <RouterLink v-if="!loggedInUserData.email || !loggedInUserData.username" class="dropdown-item" to="/register">Rejestracja</RouterLink>
            
          </div>
        </li>
      </ul>
    </div>
</nav>

</template>

<style>
</style>