# 加字幕

```shell

ffmpeg -i "Front_End_Developer_Roadmap_2024.mp4" -vf subtitles="Front_End_Developer_Roadmap_2024-ZH.srt" -y "Front_End_Developer_Roadmap_2024-ZH.mp4"

ffmpeg -i "Front_End_Developer_Roadmap_2024.mp4" -vf subtitles="Front_End_Developer_Roadmap_2024-EN.srt" -y "Front_End_Developer_Roadmap_2024-EN.mp4"
```

# 抽取音频

```shell
ffmpeg -i "Front_End_Developer_Roadmap_2024-ZH.mp4" -q:a 0 -map 0:a:0 "Front_End_Developer_Roadmap_2024-ZH.mp3"
```