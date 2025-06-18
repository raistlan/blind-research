import React, { useEffect, useRef } from 'react';

interface AudioPlayerProps {
    audioData: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioData }) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (audioRef.current && audioData) {
            // Convert base64 to blob
            const byteCharacters = atob(audioData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'audio/mp3' });
            
            // Create object URL and set as audio source
            const audioUrl = URL.createObjectURL(blob);
            audioRef.current.src = audioUrl;

            // Cleanup
            return () => URL.revokeObjectURL(audioUrl);
        }
    }, [audioData]);

    return (
        <div className="mt-4">
            <audio
                ref={audioRef}
                controls
                className="w-full"
                controlsList="nodownload"
            >
                Your browser does not support the audio element.
            </audio>
        </div>
    );
};

export default AudioPlayer; 