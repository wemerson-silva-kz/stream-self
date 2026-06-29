package ingest

import (
	"bytes"
	"context"
	"io"
	"log"
	"net"

	"github.com/yutopp/go-flv"
	flvtag "github.com/yutopp/go-flv/tag"
	"github.com/yutopp/go-rtmp"
	rtmpmsg "github.com/yutopp/go-rtmp/message"
)

// RTMPServer recebe pushes RTMP (OBS), valida a stream key e faz a ponte do
// stream para o FFmpeg via FLV (go-rtmp -> FLV encoder -> stdin do FFmpeg).
type RTMPServer struct {
	Addr     string
	Resolver *KeyResolver
	Pipeline *Pipeline
}

func (s *RTMPServer) ListenAndServe(ctx context.Context) error {
	ln, err := net.Listen("tcp", s.Addr)
	if err != nil {
		return err
	}
	srv := rtmp.NewServer(&rtmp.ServerConfig{
		OnConnect: func(conn net.Conn) (io.ReadWriteCloser, *rtmp.ConnConfig) {
			return conn, &rtmp.ConnConfig{
				Handler: &rtmpHandler{ctx: ctx, resolver: s.Resolver, pipeline: s.Pipeline},
			}
		},
	})
	go func() { <-ctx.Done(); _ = ln.Close() }()
	return srv.Serve(ln)
}

// rtmpHandler trata uma conexão de publish. A stream key vem do PublishingName
// (o "stream key" configurado no OBS).
type rtmpHandler struct {
	rtmp.DefaultHandler
	ctx      context.Context
	resolver *KeyResolver
	pipeline *Pipeline

	enc    *flv.Encoder
	pw     *io.PipeWriter
	cancel context.CancelFunc
}

func (h *rtmpHandler) OnPublish(_ *rtmp.StreamContext, _ uint32, cmd *rtmpmsg.NetStreamPublish) error {
	streamKey := cmd.PublishingName
	liveID, ok := h.resolver.Resolve(h.ctx, streamKey)
	if !ok {
		log.Printf("rtmp: stream key inválida, recusando publish")
		return io.EOF // derruba a publicação
	}
	log.Printf("rtmp: publish válido, live=%d -> iniciando FFmpeg", liveID)

	// Pipe: FLV escrito aqui -> lido pelo FFmpeg (stdin).
	pr, pw := io.Pipe()
	h.pw = pw
	enc, err := flv.NewEncoder(pw, flv.FlagsAudio|flv.FlagsVideo)
	if err != nil {
		return err
	}
	h.enc = enc

	pctx, cancel := context.WithCancel(h.ctx)
	h.cancel = cancel
	go func() {
		if err := h.pipeline.StartFLV(pctx, liveID, pr); err != nil {
			log.Printf("rtmp: ffmpeg encerrou: %v", err)
		}
	}()
	return nil
}

func (h *rtmpHandler) OnSetDataFrame(timestamp uint32, data *rtmpmsg.NetStreamSetDataFrame) error {
	if h.enc == nil {
		return nil
	}
	r := bytes.NewReader(data.Payload)
	var script flvtag.ScriptData
	if err := flvtag.DecodeScriptData(r, &script); err != nil {
		return nil // ignora metadados malformados
	}
	return h.enc.Encode(&flvtag.FlvTag{TagType: flvtag.TagTypeScriptData, Timestamp: timestamp, Data: &script})
}

func (h *rtmpHandler) OnAudio(timestamp uint32, payload io.Reader) error {
	if h.enc == nil {
		return nil
	}
	var audio flvtag.AudioData
	if err := flvtag.DecodeAudioData(payload, &audio); err != nil {
		return err
	}
	buf := new(bytes.Buffer)
	if _, err := io.Copy(buf, audio.Data); err != nil {
		return err
	}
	audio.Data = buf
	return h.enc.Encode(&flvtag.FlvTag{TagType: flvtag.TagTypeAudio, Timestamp: timestamp, Data: &audio})
}

func (h *rtmpHandler) OnVideo(timestamp uint32, payload io.Reader) error {
	if h.enc == nil {
		return nil
	}
	var video flvtag.VideoData
	if err := flvtag.DecodeVideoData(payload, &video); err != nil {
		return err
	}
	buf := new(bytes.Buffer)
	if _, err := io.Copy(buf, video.Data); err != nil {
		return err
	}
	video.Data = buf
	return h.enc.Encode(&flvtag.FlvTag{TagType: flvtag.TagTypeVideo, Timestamp: timestamp, Data: &video})
}

func (h *rtmpHandler) OnClose() {
	if h.pw != nil {
		_ = h.pw.Close()
	}
	if h.cancel != nil {
		h.cancel()
	}
}
