import React, { useEffect, useRef } from 'react';

interface AudioPlayerProps {
    audioBase64: string;
    autoPlay?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioBase64, autoPlay = false }) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (audioBase64 && audioRef.current) {
            // Convert base64 to blob URL
            const byteCharacters = atob(audioBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);

            // Set audio source
            audioRef.current.src = url;

            // Cleanup
            return () => URL.revokeObjectURL(url);
        }
    }, [audioBase64]);

    return (
        <div className="mt-4">
            <audio
                ref={audioRef}
                controls
                autoPlay={autoPlay}
                className="w-full"
            >
                Your browser does not support the audio element.
            </audio>
        </div>
    );
};

export default AudioPlayer; 