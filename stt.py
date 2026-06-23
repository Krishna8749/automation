import speech_recognition as sr
import sys
import io

# set stdout to utf-8 to avoid encoding errors on windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def transcribe(audio_path):
    r = sr.Recognizer()
    try:
        with sr.AudioFile(audio_path) as source:
            audio = r.record(source)
        # We use hi-IN to natively support Hindi and English mix
        text = r.recognize_google(audio, language="hi-IN")
        print(text)
    except sr.UnknownValueError:
        print("")
    except sr.RequestError as e:
        print(f"ERROR: {e}", file=sys.stderr)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        transcribe(sys.argv[1])
