<script setup>
import MenuBar from '../components/MenuBar.vue'
import { ref, inject, onMounted} from 'vue'
import { useRouter, } from 'vue-router'
import { useUserData } from '../composables/loggedInUserData.js'
import { useSocketIO } from '../composables/socketio.js'

const streamSaver = window.streamSaver

const loggedInUserData = useUserData()

const apiURL = inject('apiURL')
const router = useRouter()
const filesSelected = ref([])

const sixDigitCodeInput = ref('')
const generatedSixDigitCode = ref('')

const isClientUpstreaming = ref(false)
const isClientDownstreaming = ref(false)
const isOpenStreamAwaiting = ref(false)

const currentUploadedPercent = ref(0)
const currentDownloadedPercent = ref(0)

const isGivenCodeInvalid = ref(false)

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

//checking if logged in
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


function addFile(e){
    console.log(e.target.files)
    console.log("SELECTED FILES BEFORE ADDING NEW: ", filesSelected.value)
    var fileNames = filesSelected.value.map(it => it.name)
    for(var i=0; i<e.target.files.length; i++){
        if(!fileNames.includes(e.target.files[i].name)){
            filesSelected.value.push(e.target.files[i])
        }
    }
    console.log("SELECTED FILES AFTER ADDING NEW: ", filesSelected.value)
}


function removeFile(fileName){
    console.log("SELECTED FILES BEFORE REMOVING: ", filesSelected.value)
    filesSelected.value = filesSelected.value.filter(it => it.name != fileName)
    console.log("SELECTED FILES AFTER REMOVING: ", filesSelected.value)
}
function callFileInput(){
    document.getElementById('chooseFile').click()
}


const getFileSize = (sizeInBytes)=>{
    if(sizeInBytes < 1024) return ' '+sizeInBytes.toFixed(1)+' B'
    var sizeInKB = sizeInBytes/1024
    if(sizeInKB < 1024) return ' '+sizeInKB.toFixed(1)+' KB'
    var sizeInMB = sizeInKB/1024
    if(sizeInMB < 1024) return ' '+ sizeInMB.toFixed(1)+' MB'
    var sizeInGB = sizeInMB/1024
    return ' '+sizeInGB.toFixed(1)+' GB'
}


async function sendFiles(){
    var formData = new FormData()
    for(var i=0; i< filesSelected.value.length; i++){
        formData.append('file'+i, filesSelected.value[i])
    }
    try{
        const response = await fetch(apiURL + '/api/add-file-bundle', {
            method: "POST", 
            mode: "cors",     
            credentials: "include",
            body: formData, 
        });
        console.log(response)
        filesSelected.value = []
        if(response.status >= 200 && response.status < 300){
            router.push({name:'my-files'})
        }
    }catch(err){
        console.log(err)
    }
}

const socket = useSocketIO()

async function createStream(){
    if (!isOpenStreamAwaiting.value && 
            !isClientUpstreaming.value && 
            filesSelected.value.length != 0)
        socket.emit('create_stream', 'Request new stream')
}
function downloadStreamFiles(){
    if(!isClientDownstreaming.value)
        socket.emit('download_stream', {code:sixDigitCodeInput.value})
}

socket.on('stream_created', message => {
        console.log("The requested stream is created: ", message)
        generatedSixDigitCode.value = message.code
        isOpenStreamAwaiting.value = true
})

socket.on('stream_invalid', () => {
    console.log('INVALID CODE')
    isGivenCodeInvalid.value = true
})
socket.on('stream_valid', () => {
    console.log('VALID CODE')
    isGivenCodeInvalid.value = false

    isClientDownstreaming.value = true
})

function abortStream(_code){
    socket.emit('abort_stream', {code: _code})
    isOpenStreamAwaiting.value = false
}

socket.on('interrupt_download', () => {
    console.log("Download has been interrupted, ending the upload")
    isClientUpstreaming.value = false
    currentUploadedPercent.value = 0
})

/////////////
///Upload////
/////////////

var uploadState = {
    chunkSize: 1024*512,
    currentFile: 0,
    currentChunk: 0,
    numChunksPerFile: [],
    totalNumChunks: 0
}

socket.on('stream_start_upload', (destination) => {
    console.log('PREPARING TO UPLOAD TO SERVER')

    isClientUpstreaming.value = true
    isOpenStreamAwaiting.value = false

    setUpTheUpload(destination.destination)
    console.log(uploadState)
    try{
        uploadNextChunk()
    }catch(err){
        console.log("Error while uploading next chunk: ", err)
        socket.emit('end_stream', {destination: uploadState.destination})
        isClientUpstreaming.value = false
        currentUploadedPercent.value = 0
    }
})
socket.on('request_next_chunk', () => {
    uploadNextChunk()
})


function setUpTheUpload(destination){
    uploadState.destination = destination
    uploadState.currentFile = 0
    uploadState.currentChunk = 0
    uploadState.numChunksPerFile = []

    console.log("Num of files: ", filesSelected.value.length)

    for(const currentFile of filesSelected.value){

        const chunkSize = uploadState.chunkSize

        var currentFileSize = currentFile.size
        var numberOfChunks = Math.ceil(currentFile.size/chunkSize)
        console.log("Rozmiar pliku w B:", currentFileSize)
        console.log("Number of chunks: ", numberOfChunks)

        uploadState.numChunksPerFile.push(numberOfChunks)
    }
    uploadState.totalNumChunks = uploadState.numChunksPerFile.reduce((a,b) => a+b, 0)
}

function uploadNextChunk(){
    if(uploadState.currentChunk >= uploadState.numChunksPerFile[uploadState.currentFile]){
        uploadState.currentFile += 1
        uploadState.currentChunk = 0

        if(uploadState.currentFile >= uploadState.numChunksPerFile.length){
            //transmition ends when all files are transmitted
            socket.emit('end_stream', {destination: uploadState.destination})
            isClientUpstreaming.value = false
            currentUploadedPercent.value = 0
            return
        }
    }
    console.log("UPLOAD STATE", uploadState)
    var body = {destination: uploadState.destination}
    if(uploadState.currentChunk == 0){
        body['new_file'] = true
        body['filename'] = filesSelected.value[uploadState.currentFile].name
    }else{
        body['new_file'] = false
    }

    var currentFile = filesSelected.value[uploadState.currentFile]
    var offset = uploadState.currentChunk * uploadState.chunkSize
    var chunkEnd = Math.min(offset + uploadState.chunkSize, currentFile.size)
    const chunk = currentFile.slice(offset, chunkEnd)

    body['chunk'] = chunk
    body['percent_transmitted'] = currentUploadedPercent.value

    console.log("Body for next chunk:", body)

    socket.emit('next_chunk', body)

    currentUploadedPercent.value +=  100/uploadState.totalNumChunks
    uploadState.currentChunk += 1
}




////////////
//Download//
////////////

var downloadState = {
    writer: null
}

socket.on('next_chunk', async (data) => {
    try{
        await downloadNextChunk(data)
    }catch(err){
        console.log("Error occured while writing to disk: ", err)
        try{
            downloadState.writer.close()
        }catch(err){
            console.log("Could not close the the file stream")
        }
        downloadState.writer = null
        isClientDownstreaming.value = false
        currentDownloadedPercent.value = 0
        //if some error, emit an interrupt message
        socket.emit('interrupt_download', {source: data['source']})
    }    
    socket.emit('request_next_chunk', {source: data['source']})
})


async function downloadNextChunk(data){
    console.log("RECEIVED CHUNK DATA: ", data)
    if(data.new_file){
        if(downloadState.writer){
            downloadState.writer.close()
        }
        const fileStream = streamSaver.createWriteStream(data.filename)
        downloadState.writer = fileStream.getWriter()
    }
    currentDownloadedPercent.value = data.percent_transmitted
    const readableStream = new Blob([data.chunk]).stream()
    const reader = readableStream.getReader()

    //read from readable stream until the end
    var res = await reader.read()
    while(true){
        console.log(res)
        if(res.done){
            console.log("DONE READING FROM STREAM")
            break
        }else{
            console.log("BEFORE WRITING TO WRITER FROM BLOB STREAM")
            try{
                downloadState.writer.write(res.value)
            }catch(err){
                console.log("Error occured while writing to disk: ", err)
                try{
                    downloadState.writer.close()
                }catch{
                    console.log("Could not close the the file stream")
                }
                downloadState.writer = null
                isClientDownstreaming.value = false
                currentDownloadedPercent.value = 0
                //if some error, emit an interrupt message 
                socket.emit('interrupt_download', {source: data['source']})
                
            }
            console.log("AFTER WRITING TO WRITER FROM BLOB STREAM")
            res = await reader.read()
        }
    }
}

socket.on('end_stream', () => {
    console.log("RECEIVED END STREAM SIGNAL")

    downloadState.writer.close()
    downloadState.writer = null
    isClientDownstreaming.value = false
    currentDownloadedPercent.value = 0
})

</script>

<template>
    
<div class="container-fluid">

    <MenuBar />

    <div class="row">
        <div class="col-sm">
            <div class="selected-files">
                <ul>
                    <template v-for="file in filesSelected">
                        <li >{{ file.name }} {{ getFileSize(file.size) }}
                        <button @click="removeFile(file.name)" :disabled="isClientUpstreaming || isOpenStreamAwaiting" 
                            type="button">Usuń</button>
                        </li>
                    </template>
                </ul>
            </div>

            <input @change="addFile($event)" id="chooseFile" style="display:none" type="file" multiple accept="" value=""/>
            <button type="button" :disabled="isClientDownstreaming || isClientUpstreaming || isOpenStreamAwaiting"
                class="my-3" @click="callFileInput" >Dodaj pliki</button>
            
            <div class="row">
                <div class="col-sm">
                    <input @click.prevent="sendFiles" type="button" class="my-3" 
                        :disabled="!(loggedInUserData.email && loggedInUserData.username) || isClientDownstreaming || isClientUpstreaming || isOpenStreamAwaiting" value="Zapisz pliki na dysku"/>
                </div>
                <div class="col-sm">
                    <input @click.prevent="createStream" :disabled="isClientDownstreaming || isClientUpstreaming || isOpenStreamAwaiting" type="button" class="my-3" value="Zacznij strumieniowanie"/> <br>
                    <span v-if="generatedSixDigitCode && isOpenStreamAwaiting">Kod do pobrania: {{ generatedSixDigitCode }}</span>
                    <p v-if="isClientUpstreaming">Trwa wysyłanie plików plików {{ currentUploadedPercent.toFixed(1) }}%</p>
                    <p v-else-if="isOpenStreamAwaiting">Oczekuję na rozpoczęcie odbierania</p>
                    <button v-if="isOpenStreamAwaiting" @click="abortStream(generatedSixDigitCode)">Anuluj</button>
                </div>
            </div>
        </div>
    </div>
    <div class="row">
        <div class="col-md">
            <h5>Odbierz</h5>
            <input v-model="sixDigitCodeInput" :disabled="isClientDownstreaming || isClientUpstreaming || isOpenStreamAwaiting" placeholder="Wprowadź kod"/><br><br>
            <p v-if="isGivenCodeInvalid">Kod nie jest aktywny</p>
            <button @click="downloadStreamFiles" :disabled="isClientDownstreaming || isClientUpstreaming || isOpenStreamAwaiting">Odbierz</button>
            <p v-if="isClientDownstreaming">Trwa odbieranie plików {{ currentDownloadedPercent.toFixed(1) }}%</p>
            
        </div>
    </div>
</div>
</template>

<style>
.selected-files{
    border: 1px dashed;
    min-width:200px; 
    min-height:200px;
}
</style>