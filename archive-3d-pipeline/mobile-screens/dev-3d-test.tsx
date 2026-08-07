// ⚠️ SPIKE DE DEV — pantalla de prueba para validar el stack expo-gl + Three.js
// (sección 2.1 de spec-sistema-modelos-3d-dnd.md). Borrar cuando termine el spike.
import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer, THREE } from 'expo-three';
import { useRouter } from 'expo-router';
import { createEspadaCortaModel } from '../utils/createEspadaCortaModel';

export default function Dev3DTest() {
    const router = useRouter();
    const [fps, setFps] = useState(0);
    const [modelError, setModelError] = useState<string | null>(null);
    const frameCount = useRef(0);
    const lastFpsUpdate = useRef(0);

    const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
        const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

        // expo-three@8 trae tipos desactualizados para Renderer (no declara
        // setSize/setClearColor/render aunque existen en runtime, hereda de
        // THREE.WebGLRenderer) — cast explícito hasta reemplazar el wrapper.
        const renderer = new Renderer({ gl }) as unknown as THREE.WebGLRenderer;
        renderer.setSize(width, height);
        // Fondo de estudio oscuro, no viñeta radial real (eso exigiría una textura de
        // fondo) pero el tono coincide con la referencia: marrón muy oscuro, no negro puro.
        renderer.setClearColor(0x150d08, 1);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 100);

        // Una sola luz dura cenital/frontal-alta (como la foto de referencia: sombras
        // definidas, no difusas) en vez de 3 luces genéricas parejas.
        const ambient = new THREE.AmbientLight(0xffffff, 0.18);
        scene.add(ambient);
        const key = new THREE.DirectionalLight(0xfff4e0, 2.2);
        key.position.set(0.4, 3, 1.2);
        scene.add(key);
        // Rim light sutil en el filo, como la línea de brillo del borde en la referencia.
        const rim = new THREE.DirectionalLight(0xffb066, 0.5);
        rim.position.set(-1.5, 0.3, -1.8);
        scene.add(rim);

        // Modelo real generado por img2threejs a partir de la Espada Corta del
        // catálogo (ver spec-sistema-modelos-3d-dnd.md sección 6) — primera vez
        // que se ve renderizado en un dispositivo real en vez de un navegador headless.
        let mesh: THREE.Object3D;
        try {
            mesh = createEspadaCortaModel();
            console.log('sockets:', Object.keys(mesh.userData.sculptRuntime?.sockets ?? {}));
        } catch (err) {
            const e = err as Error;
            setModelError(`${e?.message ?? err}\n\n${e?.stack ?? '(no stack)'}`);
            mesh = new THREE.Mesh(
                new THREE.TorusKnotGeometry(0.7, 0.22, 150, 24),
                new THREE.MeshStandardMaterial({ color: 0xff0000, wireframe: true }),
            );
        }
        scene.add(mesh);

        const bbox = new THREE.Box3().setFromObject(mesh);
        const center = bbox.getCenter(new THREE.Vector3());
        const diagonal = bbox.getSize(new THREE.Vector3()).length() || 1;
        const camDist = diagonal * 1.6;
        camera.position.set(center.x + camDist * 0.4, center.y + camDist * 0.3, center.z + camDist * 0.9);
        camera.lookAt(center);

        const render = () => {
            requestAnimationFrame(render);

            frameCount.current += 1;
            const now = Date.now();
            if (now - lastFpsUpdate.current > 500) {
                setFps(Math.round((frameCount.current * 1000) / (now - lastFpsUpdate.current)));
                frameCount.current = 0;
                lastFpsUpdate.current = now;
            }

            mesh.rotation.y += 0.012;

            renderer.render(scene, camera);
            gl.endFrameEXP();
        };
        render();
    };

    return (
        <View style={styles.container}>
            <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
            <View style={styles.overlay} pointerEvents="box-none">
                <Text style={styles.title}>Espada Corta — generada por img2threejs</Text>
                <Text style={styles.fps}>{fps} FPS</Text>
                {modelError ? (
                    <ScrollView style={styles.errorScroll}>
                        <Text style={styles.error}>Error al construir el modelo:{'\n'}{modelError}</Text>
                    </ScrollView>
                ) : (
                    <Text style={styles.hint}>
                        Si ves la espada girando (no el torus rojo de fallback), el pipeline completo funciona en el dispositivo real.
                    </Text>
                )}
                <TouchableOpacity style={styles.back} onPress={() => router.back()}>
                    <Text style={styles.backText}>Volver</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0B0F19' },
    overlay: { position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center' },
    title: { color: '#F59E0B', fontWeight: '700', fontSize: 16 },
    fps: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4 },
    hint: { color: '#9CA3AF', fontSize: 12, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 },
    error: { color: '#F87171', fontSize: 10, textAlign: 'left', paddingHorizontal: 16 },
    errorScroll: { maxHeight: 420, marginTop: 8, alignSelf: 'stretch' },
    back: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20 },
    backText: { color: '#fff', fontWeight: '600' },
});
