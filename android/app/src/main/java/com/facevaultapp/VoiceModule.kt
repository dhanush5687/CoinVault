package com.facevaultapp

import android.media.MediaPlayer
import android.media.MediaRecorder
import android.os.Build
import android.util.Base64
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileOutputStream

class VoiceModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private var recorder: MediaRecorder? = null
    private var player: MediaPlayer? = null
    private var outputFile: File? = null
    private var isRecording = false

    override fun getName(): String = "VoiceModule"

    @ReactMethod
    fun startRecording(promise: Promise) {
        try {
            if (isRecording) {
                stopRecordingInternal()
            }
            outputFile = File(reactApplicationContext.cacheDir, "voice_temp_${System.currentTimeMillis()}.m4a")
            recorder = (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(reactApplicationContext)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }).apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioEncodingBitRate(64000)
                setAudioSamplingRate(44100)
                setOutputFile(outputFile!!.absolutePath)
                prepare()
                start()
            }
            isRecording = true
            promise.resolve(outputFile!!.absolutePath)
        } catch (e: Exception) {
            isRecording = false
            try {
                recorder?.release()
            } catch (_: Exception) {}
            recorder = null
            promise.reject("RECORD_ERROR", e.message)
        }
    }

    private fun stopRecordingInternal(): String? {
        if (!isRecording) return null
        try {
            recorder?.apply {
                stop()
                release()
            }
        } catch (e: Exception) {
            // ignore
        } finally {
            recorder = null
            isRecording = false
        }
        val file = outputFile ?: return null
        if (!file.exists()) return null
        val bytes = file.readBytes()
        file.delete()
        return Base64.encodeToString(bytes, Base64.NO_WRAP)
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        try {
            val base64 = stopRecordingInternal()
            if (base64 != null) {
                promise.resolve("data:audio/m4a;base64,$base64")
            } else {
                promise.reject("STOP_ERROR", "No recording found or recording was too short")
            }
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun cancelRecording(promise: Promise) {
        try {
            stopRecordingInternal()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message)
        }
    }

    @ReactMethod
    fun playAudio(audioData: String, promise: Promise) {
        try {
            stopAudioInternal()
            player = MediaPlayer().apply {
                if (audioData.startsWith("data:audio") || audioData.startsWith("data:application")) {
                    val base64Part = audioData.substringAfter("base64,")
                    val decodedBytes = Base64.decode(base64Part, Base64.DEFAULT)
                    val tempPlayFile = File(reactApplicationContext.cacheDir, "play_temp.m4a")
                    FileOutputStream(tempPlayFile).use { it.write(decodedBytes) }
                    setDataSource(tempPlayFile.absolutePath)
                } else {
                    setDataSource(audioData)
                }
                prepare()
                setOnCompletionListener {
                    stopAudioInternal()
                }
                start()
            }
            val duration = player?.duration ?: 0
            promise.resolve(duration)
        } catch (e: Exception) {
            stopAudioInternal()
            promise.reject("PLAY_ERROR", e.message)
        }
    }

    private fun stopAudioInternal() {
        try {
            player?.apply {
                if (isPlaying) {
                    stop()
                }
                release()
            }
        } catch (e: Exception) {
            // ignore
        } finally {
            player = null
        }
    }

    @ReactMethod
    fun stopAudio(promise: Promise) {
        try {
            stopAudioInternal()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_AUDIO_ERROR", e.message)
        }
    }

    @ReactMethod
    fun isPlaying(promise: Promise) {
        promise.resolve(player?.isPlaying ?: false)
    }
}

