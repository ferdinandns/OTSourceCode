--
-- PostgreSQL database dump
--

\restrict tp4s7CtW0c4hmCtuCotrLWQlfdstTH0Djt7tS4jkHUHMKCtcNpsvPPVVQcAx2bb

-- Dumped from database version 17.9
-- Dumped by pg_dump version 17.9

-- Started on 2026-05-18 09:10:58

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 49173)
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- TOC entry 5074 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- TOC entry 239 (class 1255 OID 16467)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 235 (class 1259 OID 49156)
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_logs (
    id integer NOT NULL,
    "time" timestamp without time zone DEFAULT now() NOT NULL,
    name character varying(255) NOT NULL,
    division character varying(50) NOT NULL,
    action character varying(20) NOT NULL,
    table_name character varying(50) NOT NULL,
    no_data character varying(100) NOT NULL,
    detail text NOT NULL,
    CONSTRAINT activity_logs_action_check CHECK (((action)::text = ANY ((ARRAY['create'::character varying, 'update'::character varying, 'delete'::character varying, 'restore'::character varying])::text[]))),
    CONSTRAINT activity_logs_table_name_check CHECK (((table_name)::text = ANY ((ARRAY['Diversifikasi RM'::character varying, 'Diversifikasi PM'::character varying])::text[])))
);


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 49155)
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.activity_logs_id_seq OWNER TO postgres;

--
-- TOC entry 5075 (class 0 OID 0)
-- Dependencies: 234
-- Name: activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;


--
-- TOC entry 229 (class 1259 OID 32772)
-- Name: diversifikasi_pm; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.diversifikasi_pm (
    id integer NOT NULL,
    nomor_pm character varying(20) NOT NULL,
    revision integer DEFAULT 0 NOT NULL,
    parent_id integer,
    status_project character varying(20) DEFAULT ''::character varying,
    tgl_penerimaan date,
    kode_item character varying(100),
    nama_material character varying(255),
    manufacture character varying(255),
    no_batch_material character varying(100),
    pm_tgl_analisa date,
    pm_tgl_report date,
    pm_hasil_analisa character varying(20) DEFAULT ''::character varying,
    pm_keterangan text,
    trial_kode_produk character varying(100),
    trial_no_batch character varying(100),
    trial_hasil_final character varying(10) DEFAULT ''::character varying,
    link_file_diversifikasi text,
    kesimpulan text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(100),
    updated_by character varying(100),
    deleted_at timestamp without time zone,
    deleted_by character varying(255) DEFAULT NULL::character varying,
    CONSTRAINT diversifikasi_pm_pm_hasil_analisa_check CHECK (((pm_hasil_analisa)::text = ANY ((ARRAY['Reject'::character varying, 'Release'::character varying, 'On Progress'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_pm_status_project_check CHECK (((status_project)::text = ANY ((ARRAY['Done'::character varying, 'Drop'::character varying, 'On Progress'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_pm_trial_hasil_final_check CHECK (((trial_hasil_final)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[])))
);


ALTER TABLE public.diversifikasi_pm OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 32771)
-- Name: diversifikasi_pm_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.diversifikasi_pm_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.diversifikasi_pm_id_seq OWNER TO postgres;

--
-- TOC entry 5076 (class 0 OID 0)
-- Dependencies: 228
-- Name: diversifikasi_pm_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.diversifikasi_pm_id_seq OWNED BY public.diversifikasi_pm.id;


--
-- TOC entry 227 (class 1259 OID 24634)
-- Name: diversifikasi_produk; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.diversifikasi_produk (
    id integer NOT NULL,
    diversifikasi_rm_id integer NOT NULL,
    kode_produk character varying(100),
    produk_tgl_kirim_qc date,
    produk_tgl_keluar_hasil date,
    produk_fisik character varying(10) DEFAULT ''::character varying,
    produk_kimia character varying(10) DEFAULT ''::character varying,
    produk_mikrobiologi character varying(10) DEFAULT ''::character varying,
    produk_sensori character varying(10) DEFAULT ''::character varying,
    produk_cek_karakteristik character varying(10) DEFAULT ''::character varying,
    stabtest_fisik character varying(10) DEFAULT ''::character varying,
    stabtest_kimia character varying(10) DEFAULT ''::character varying,
    stabtest_mikrobiologi character varying(10) DEFAULT ''::character varying,
    stabtest_sensori_dfct character varying(10) DEFAULT ''::character varying,
    stabtest_status character varying(20) DEFAULT ''::character varying,
    keterangan text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT diversifikasi_produk_produk_cek_karakteristik_check CHECK (((produk_cek_karakteristik)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_produk_produk_fisik_check CHECK (((produk_fisik)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_produk_produk_kimia_check CHECK (((produk_kimia)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_produk_produk_mikrobiologi_check CHECK (((produk_mikrobiologi)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_produk_produk_sensori_check CHECK (((produk_sensori)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_produk_stabtest_fisik_check CHECK (((stabtest_fisik)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_produk_stabtest_kimia_check CHECK (((stabtest_kimia)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_produk_stabtest_mikrobiologi_check CHECK (((stabtest_mikrobiologi)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_produk_stabtest_sensori_dfct_check CHECK (((stabtest_sensori_dfct)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_produk_stabtest_status_check CHECK (((stabtest_status)::text = ANY ((ARRAY['Reject'::character varying, 'Release'::character varying, 'On Progress'::character varying, 'N/A'::character varying, ''::character varying])::text[])))
);


ALTER TABLE public.diversifikasi_produk OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 24633)
-- Name: diversifikasi_produk_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.diversifikasi_produk_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.diversifikasi_produk_id_seq OWNER TO postgres;

--
-- TOC entry 5077 (class 0 OID 0)
-- Dependencies: 226
-- Name: diversifikasi_produk_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.diversifikasi_produk_id_seq OWNED BY public.diversifikasi_produk.id;


--
-- TOC entry 231 (class 1259 OID 32795)
-- Name: diversifikasi_produk_pm; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.diversifikasi_produk_pm (
    id integer NOT NULL,
    diversifikasi_pm_id integer NOT NULL,
    kode_produk character varying(100),
    produk_tgl_kirim_qc date,
    produk_tgl_keluar_hasil date,
    evaluasi_as_kemasan character varying(10) DEFAULT ''::character varying,
    produk_fisik character varying(10) DEFAULT ''::character varying,
    produk_kimia character varying(10) DEFAULT ''::character varying,
    produk_mikrobiologi character varying(10) DEFAULT ''::character varying,
    produk_sensori character varying(10) DEFAULT ''::character varying,
    produk_cek_karakteristik character varying(10) DEFAULT ''::character varying,
    stabtest_fisik character varying(10) DEFAULT ''::character varying,
    stabtest_kimia character varying(10) DEFAULT ''::character varying,
    stabtest_mikrobiologi character varying(10) DEFAULT ''::character varying,
    stabtest_sensori_dfct character varying(10) DEFAULT ''::character varying,
    stabtest_keterangan text,
    stabtest_status character varying(20) DEFAULT ''::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT diversifikasi_produk_pm_evaluasi_as_kemasan_check CHECK (((evaluasi_as_kemasan)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_produk_pm_produk_cek_karakteristik_check CHECK (((produk_cek_karakteristik)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_produk_pm_produk_fisik_check CHECK (((produk_fisik)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_produk_pm_produk_kimia_check CHECK (((produk_kimia)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_produk_pm_produk_mikrobiologi_check CHECK (((produk_mikrobiologi)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_produk_pm_produk_sensori_check CHECK (((produk_sensori)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_produk_pm_stabtest_fisik_check CHECK (((stabtest_fisik)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_produk_pm_stabtest_kimia_check CHECK (((stabtest_kimia)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_produk_pm_stabtest_mikrobiologi_check CHECK (((stabtest_mikrobiologi)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_produk_pm_stabtest_sensori_dfct_check CHECK (((stabtest_sensori_dfct)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_produk_pm_stabtest_status_check CHECK (((stabtest_status)::text = ANY ((ARRAY['Reject'::character varying, 'Release'::character varying, 'On Progress'::character varying, 'N/A'::character varying, ''::character varying])::text[])))
);


ALTER TABLE public.diversifikasi_produk_pm OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 32794)
-- Name: diversifikasi_produk_pm_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.diversifikasi_produk_pm_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.diversifikasi_produk_pm_id_seq OWNER TO postgres;

--
-- TOC entry 5078 (class 0 OID 0)
-- Dependencies: 230
-- Name: diversifikasi_produk_pm_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.diversifikasi_produk_pm_id_seq OWNED BY public.diversifikasi_produk_pm.id;


--
-- TOC entry 225 (class 1259 OID 24592)
-- Name: diversifikasi_rm; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.diversifikasi_rm (
    id integer NOT NULL,
    nomor_rm character varying(20) NOT NULL,
    revision integer DEFAULT 0 NOT NULL,
    parent_id integer,
    status_project character varying(20) DEFAULT ''::character varying,
    tgl_kirim_cpro date,
    tgl_terima_ts date,
    kode_item character varying(100),
    nama_material character varying(255),
    manufacture character varying(255),
    no_batch_material character varying(100),
    perlu_analisa_andev character varying(3) DEFAULT ''::character varying,
    andev_kimia character varying(10) DEFAULT ''::character varying,
    andev_verifikasi_ma character varying(10) DEFAULT ''::character varying,
    andev_status character varying(20) DEFAULT ''::character varying,
    rm_tgl_kirim_qc date,
    rm_tgl_keluar_hasil_analisa date,
    rm_fisik character varying(10) DEFAULT ''::character varying,
    rm_kimia character varying(10) DEFAULT ''::character varying,
    rm_mikrobiologi character varying(10) DEFAULT ''::character varying,
    rm_sensori_material character varying(10) DEFAULT ''::character varying,
    rm_cek_karakteristik character varying(10) DEFAULT ''::character varying,
    rm_status character varying(20) DEFAULT ''::character varying,
    scale_up_kode_produk character varying(100) DEFAULT ''::character varying,
    no_batch_scale_up character varying(100),
    scale_up_status character varying(20) DEFAULT ''::character varying,
    tgl_dilakukan_scale_up date,
    scale_up_tgl_kirim_qc date,
    scale_up_tgl_keluar_hasil_analisa date,
    link_file_diversifikasi text,
    kesimpulan text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by character varying(100),
    updated_by character varying(100),
    deleted_at timestamp without time zone,
    deleted_by character varying(255) DEFAULT NULL::character varying,
    CONSTRAINT diversifikasi_rm_andev_kimia_check CHECK (((andev_kimia)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_rm_andev_status_check CHECK (((andev_status)::text = ANY ((ARRAY['Reject'::character varying, 'Release'::character varying, 'On Progress'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_rm_andev_verifikasi_ma_check CHECK (((andev_verifikasi_ma)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_rm_perlu_analisa_andev_check CHECK (((perlu_analisa_andev)::text = ANY ((ARRAY['Yes'::character varying, 'No'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_rm_rm_cek_karakteristik_check CHECK (((rm_cek_karakteristik)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_rm_rm_fisik_check CHECK (((rm_fisik)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_rm_rm_kimia_check CHECK (((rm_kimia)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_rm_rm_mikrobiologi_check CHECK (((rm_mikrobiologi)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_rm_rm_sensori_material_check CHECK (((rm_sensori_material)::text = ANY ((ARRAY['MS'::character varying, 'TMS'::character varying, 'OP'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_rm_rm_status_check CHECK (((rm_status)::text = ANY ((ARRAY['Reject'::character varying, 'Release'::character varying, 'On Progress'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_rm_scale_up_status_check CHECK (((scale_up_status)::text = ANY ((ARRAY['Reject'::character varying, 'Release'::character varying, 'On Progress'::character varying, 'N/A'::character varying, ''::character varying])::text[]))),
    CONSTRAINT diversifikasi_rm_status_project_check CHECK (((status_project)::text = ANY ((ARRAY['Done'::character varying, 'Drop'::character varying, 'On Progress'::character varying, ''::character varying])::text[])))
);


ALTER TABLE public.diversifikasi_rm OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 24591)
-- Name: diversifikasi_rm_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.diversifikasi_rm_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.diversifikasi_rm_id_seq OWNER TO postgres;

--
-- TOC entry 5079 (class 0 OID 0)
-- Dependencies: 224
-- Name: diversifikasi_rm_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.diversifikasi_rm_id_seq OWNED BY public.diversifikasi_rm.id;


--
-- TOC entry 219 (class 1259 OID 16437)
-- Name: master_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.master_items (
    id integer NOT NULL,
    kode_item character varying(100),
    nama_material character varying(255),
    manufacture character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.master_items OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 16436)
-- Name: master_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.master_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.master_items_id_seq OWNER TO postgres;

--
-- TOC entry 5080 (class 0 OID 0)
-- Dependencies: 218
-- Name: master_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.master_items_id_seq OWNED BY public.master_items.id;


--
-- TOC entry 233 (class 1259 OID 32840)
-- Name: master_items_pm; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.master_items_pm (
    id integer NOT NULL,
    kode_item character varying(100) NOT NULL,
    nama_material character varying(255) NOT NULL,
    manufacture character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.master_items_pm OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 32839)
-- Name: master_items_pm_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.master_items_pm_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.master_items_pm_id_seq OWNER TO postgres;

--
-- TOC entry 5081 (class 0 OID 0)
-- Dependencies: 232
-- Name: master_items_pm_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.master_items_pm_id_seq OWNED BY public.master_items_pm.id;


--
-- TOC entry 223 (class 1259 OID 16544)
-- Name: master_products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.master_products (
    id integer NOT NULL,
    kode_produk character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.master_products OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16543)
-- Name: master_products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.master_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.master_products_id_seq OWNER TO postgres;

--
-- TOC entry 5082 (class 0 OID 0)
-- Dependencies: 222
-- Name: master_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.master_products_id_seq OWNED BY public.master_products.id;


--
-- TOC entry 236 (class 1259 OID 49280)
-- Name: nomor_pm_counter; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nomor_pm_counter (
    prefix text NOT NULL,
    last_counter integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.nomor_pm_counter OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16450)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(500) NOT NULL,
    division character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    password_encoded character varying(500) DEFAULT ''::character varying NOT NULL,
    refresh_token text,
    refresh_token_expiry timestamp without time zone,
    last_activity timestamp without time zone,
    CONSTRAINT users_division_check CHECK (((division)::text = ANY ((ARRAY['Admin'::character varying, 'CPro'::character varying, 'QC'::character varying, 'TS'::character varying, 'Andev'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 16449)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 5083 (class 0 OID 0)
-- Dependencies: 220
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 4800 (class 2604 OID 49159)
-- Name: activity_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);


--
-- TOC entry 4775 (class 2604 OID 32775)
-- Name: diversifikasi_pm id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diversifikasi_pm ALTER COLUMN id SET DEFAULT nextval('public.diversifikasi_pm_id_seq'::regclass);


--
-- TOC entry 4762 (class 2604 OID 24637)
-- Name: diversifikasi_produk id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diversifikasi_produk ALTER COLUMN id SET DEFAULT nextval('public.diversifikasi_produk_id_seq'::regclass);


--
-- TOC entry 4783 (class 2604 OID 32798)
-- Name: diversifikasi_produk_pm id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diversifikasi_produk_pm ALTER COLUMN id SET DEFAULT nextval('public.diversifikasi_produk_pm_id_seq'::regclass);


--
-- TOC entry 4744 (class 2604 OID 24595)
-- Name: diversifikasi_rm id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diversifikasi_rm ALTER COLUMN id SET DEFAULT nextval('public.diversifikasi_rm_id_seq'::regclass);


--
-- TOC entry 4734 (class 2604 OID 16440)
-- Name: master_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.master_items ALTER COLUMN id SET DEFAULT nextval('public.master_items_id_seq'::regclass);


--
-- TOC entry 4797 (class 2604 OID 32843)
-- Name: master_items_pm id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.master_items_pm ALTER COLUMN id SET DEFAULT nextval('public.master_items_pm_id_seq'::regclass);


--
-- TOC entry 4741 (class 2604 OID 16547)
-- Name: master_products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.master_products ALTER COLUMN id SET DEFAULT nextval('public.master_products_id_seq'::regclass);


--
-- TOC entry 4737 (class 2604 OID 16453)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 4904 (class 2606 OID 49166)
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4873 (class 2606 OID 32788)
-- Name: diversifikasi_pm diversifikasi_pm_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diversifikasi_pm
    ADD CONSTRAINT diversifikasi_pm_pkey PRIMARY KEY (id);


--
-- TOC entry 4871 (class 2606 OID 24663)
-- Name: diversifikasi_produk diversifikasi_produk_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diversifikasi_produk
    ADD CONSTRAINT diversifikasi_produk_pkey PRIMARY KEY (id);


--
-- TOC entry 4894 (class 2606 OID 32826)
-- Name: diversifikasi_produk_pm diversifikasi_produk_pm_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diversifikasi_produk_pm
    ADD CONSTRAINT diversifikasi_produk_pm_pkey PRIMARY KEY (id);


--
-- TOC entry 4862 (class 2606 OID 24627)
-- Name: diversifikasi_rm diversifikasi_rm_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diversifikasi_rm
    ADD CONSTRAINT diversifikasi_rm_pkey PRIMARY KEY (id);


--
-- TOC entry 4844 (class 2606 OID 16448)
-- Name: master_items master_items_kode_item_manufacture_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.master_items
    ADD CONSTRAINT master_items_kode_item_manufacture_key UNIQUE (kode_item, manufacture);


--
-- TOC entry 4846 (class 2606 OID 16446)
-- Name: master_items master_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.master_items
    ADD CONSTRAINT master_items_pkey PRIMARY KEY (id);


--
-- TOC entry 4900 (class 2606 OID 32851)
-- Name: master_items_pm master_items_pm_kode_item_manufacture_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.master_items_pm
    ADD CONSTRAINT master_items_pm_kode_item_manufacture_key UNIQUE (kode_item, manufacture);


--
-- TOC entry 4902 (class 2606 OID 32849)
-- Name: master_items_pm master_items_pm_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.master_items_pm
    ADD CONSTRAINT master_items_pm_pkey PRIMARY KEY (id);


--
-- TOC entry 4858 (class 2606 OID 16553)
-- Name: master_products master_products_kode_item_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.master_products
    ADD CONSTRAINT master_products_kode_item_key UNIQUE (kode_produk);


--
-- TOC entry 4860 (class 2606 OID 16551)
-- Name: master_products master_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.master_products
    ADD CONSTRAINT master_products_pkey PRIMARY KEY (id);


--
-- TOC entry 4913 (class 2606 OID 49287)
-- Name: nomor_pm_counter nomor_pm_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nomor_pm_counter
    ADD CONSTRAINT nomor_pm_counter_pkey PRIMARY KEY (prefix);


--
-- TOC entry 4892 (class 2606 OID 49279)
-- Name: diversifikasi_pm uq_pm_nomor_revision; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diversifikasi_pm
    ADD CONSTRAINT uq_pm_nomor_revision UNIQUE (nomor_pm, revision);


--
-- TOC entry 4853 (class 2606 OID 16462)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4855 (class 2606 OID 16460)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4905 (class 1259 OID 49168)
-- Name: idx_activity_logs_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_action ON public.activity_logs USING btree (action);


--
-- TOC entry 4906 (class 1259 OID 49267)
-- Name: idx_activity_logs_detail_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_detail_trgm ON public.activity_logs USING gin (detail public.gin_trgm_ops);


--
-- TOC entry 4907 (class 1259 OID 49265)
-- Name: idx_activity_logs_division_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_division_trgm ON public.activity_logs USING gin (division public.gin_trgm_ops);


--
-- TOC entry 4908 (class 1259 OID 49264)
-- Name: idx_activity_logs_name_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_name_trgm ON public.activity_logs USING gin (name public.gin_trgm_ops);


--
-- TOC entry 4909 (class 1259 OID 49266)
-- Name: idx_activity_logs_no_data_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_no_data_trgm ON public.activity_logs USING gin (no_data public.gin_trgm_ops);


--
-- TOC entry 4910 (class 1259 OID 49169)
-- Name: idx_activity_logs_table_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_table_name ON public.activity_logs USING btree (table_name);


--
-- TOC entry 4911 (class 1259 OID 49167)
-- Name: idx_activity_logs_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_time ON public.activity_logs USING btree ("time" DESC);


--
-- TOC entry 4874 (class 1259 OID 32834)
-- Name: idx_div_pm_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_div_pm_created ON public.diversifikasi_pm USING btree (created_at DESC);


--
-- TOC entry 4875 (class 1259 OID 32835)
-- Name: idx_div_pm_material; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_div_pm_material ON public.diversifikasi_pm USING btree (nama_material);


--
-- TOC entry 4876 (class 1259 OID 32832)
-- Name: idx_div_pm_nomor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_div_pm_nomor ON public.diversifikasi_pm USING btree (nomor_pm);


--
-- TOC entry 4877 (class 1259 OID 32833)
-- Name: idx_div_pm_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_div_pm_parent ON public.diversifikasi_pm USING btree (parent_id);


--
-- TOC entry 4895 (class 1259 OID 32836)
-- Name: idx_div_produk_pm_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_div_produk_pm_id ON public.diversifikasi_produk_pm USING btree (diversifikasi_pm_id);


--
-- TOC entry 4878 (class 1259 OID 40987)
-- Name: idx_diversifikasi_pm_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_diversifikasi_pm_deleted_at ON public.diversifikasi_pm USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);


--
-- TOC entry 4879 (class 1259 OID 49272)
-- Name: idx_diversifikasi_pm_list; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_diversifikasi_pm_list ON public.diversifikasi_pm USING btree (id DESC) WHERE ((deleted_at IS NULL) AND (parent_id IS NULL));


--
-- TOC entry 4880 (class 1259 OID 49273)
-- Name: idx_diversifikasi_pm_search; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_diversifikasi_pm_search ON public.diversifikasi_pm USING gin (nomor_pm public.gin_trgm_ops, kode_item public.gin_trgm_ops, nama_material public.gin_trgm_ops, manufacture public.gin_trgm_ops);


--
-- TOC entry 4863 (class 1259 OID 40986)
-- Name: idx_diversifikasi_rm_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_diversifikasi_rm_deleted_at ON public.diversifikasi_rm USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);


--
-- TOC entry 4842 (class 1259 OID 16466)
-- Name: idx_master_items_kode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_master_items_kode ON public.master_items USING btree (kode_item);


--
-- TOC entry 4897 (class 1259 OID 32852)
-- Name: idx_master_items_pm_kode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_master_items_pm_kode ON public.master_items_pm USING btree (kode_item);


--
-- TOC entry 4898 (class 1259 OID 32853)
-- Name: idx_master_items_pm_nama; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_master_items_pm_nama ON public.master_items_pm USING btree (nama_material);


--
-- TOC entry 4856 (class 1259 OID 16559)
-- Name: idx_master_products_kode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_master_products_kode ON public.master_products USING btree (kode_produk);


--
-- TOC entry 4881 (class 1259 OID 57467)
-- Name: idx_pm_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pm_created_at ON public.diversifikasi_pm USING btree (created_at DESC);


--
-- TOC entry 4882 (class 1259 OID 49172)
-- Name: idx_pm_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pm_deleted_at ON public.diversifikasi_pm USING btree (deleted_at DESC) WHERE (deleted_at IS NOT NULL);


--
-- TOC entry 4883 (class 1259 OID 49263)
-- Name: idx_pm_deleted_by_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pm_deleted_by_trgm ON public.diversifikasi_pm USING gin (deleted_by public.gin_trgm_ops) WHERE (deleted_at IS NOT NULL);


--
-- TOC entry 4884 (class 1259 OID 49260)
-- Name: idx_pm_kode_item_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pm_kode_item_trgm ON public.diversifikasi_pm USING gin (kode_item public.gin_trgm_ops) WHERE (deleted_at IS NOT NULL);


--
-- TOC entry 4885 (class 1259 OID 49262)
-- Name: idx_pm_manufacture_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pm_manufacture_trgm ON public.diversifikasi_pm USING gin (manufacture public.gin_trgm_ops) WHERE (deleted_at IS NOT NULL);


--
-- TOC entry 4886 (class 1259 OID 49261)
-- Name: idx_pm_nama_material_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pm_nama_material_trgm ON public.diversifikasi_pm USING gin (nama_material public.gin_trgm_ops) WHERE (deleted_at IS NOT NULL);


--
-- TOC entry 4887 (class 1259 OID 49259)
-- Name: idx_pm_nomor_pm_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pm_nomor_pm_trgm ON public.diversifikasi_pm USING gin (nomor_pm public.gin_trgm_ops) WHERE (deleted_at IS NOT NULL);


--
-- TOC entry 4888 (class 1259 OID 57465)
-- Name: idx_pm_search_kode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pm_search_kode ON public.diversifikasi_pm USING btree (kode_item);


--
-- TOC entry 4889 (class 1259 OID 57464)
-- Name: idx_pm_search_nomor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pm_search_nomor ON public.diversifikasi_pm USING btree (nomor_pm);


--
-- TOC entry 4890 (class 1259 OID 57466)
-- Name: idx_pm_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pm_status ON public.diversifikasi_pm USING btree (status_project);


--
-- TOC entry 4896 (class 1259 OID 57468)
-- Name: idx_produk_pm_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_produk_pm_parent ON public.diversifikasi_produk_pm USING btree (diversifikasi_pm_id);


--
-- TOC entry 4864 (class 1259 OID 49171)
-- Name: idx_rm_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rm_deleted_at ON public.diversifikasi_rm USING btree (deleted_at DESC) WHERE (deleted_at IS NOT NULL);


--
-- TOC entry 4865 (class 1259 OID 49258)
-- Name: idx_rm_deleted_by_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rm_deleted_by_trgm ON public.diversifikasi_rm USING gin (deleted_by public.gin_trgm_ops) WHERE (deleted_at IS NOT NULL);


--
-- TOC entry 4866 (class 1259 OID 49255)
-- Name: idx_rm_kode_item_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rm_kode_item_trgm ON public.diversifikasi_rm USING gin (kode_item public.gin_trgm_ops) WHERE (deleted_at IS NOT NULL);


--
-- TOC entry 4867 (class 1259 OID 49257)
-- Name: idx_rm_manufacture_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rm_manufacture_trgm ON public.diversifikasi_rm USING gin (manufacture public.gin_trgm_ops) WHERE (deleted_at IS NOT NULL);


--
-- TOC entry 4868 (class 1259 OID 49256)
-- Name: idx_rm_nama_material_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rm_nama_material_trgm ON public.diversifikasi_rm USING gin (nama_material public.gin_trgm_ops) WHERE (deleted_at IS NOT NULL);


--
-- TOC entry 4869 (class 1259 OID 49254)
-- Name: idx_rm_nomor_rm_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rm_nomor_rm_trgm ON public.diversifikasi_rm USING gin (nomor_rm public.gin_trgm_ops) WHERE (deleted_at IS NOT NULL);


--
-- TOC entry 4847 (class 1259 OID 49268)
-- Name: idx_users_division; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_division ON public.users USING btree (division);


--
-- TOC entry 4848 (class 1259 OID 49271)
-- Name: idx_users_division_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_division_trgm ON public.users USING gin (division public.gin_trgm_ops);


--
-- TOC entry 4849 (class 1259 OID 49270)
-- Name: idx_users_email_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email_trgm ON public.users USING gin (email public.gin_trgm_ops);


--
-- TOC entry 4850 (class 1259 OID 49269)
-- Name: idx_users_name_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_name_trgm ON public.users USING gin (name public.gin_trgm_ops);


--
-- TOC entry 4851 (class 1259 OID 49170)
-- Name: idx_users_refresh_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_refresh_token ON public.users USING btree (refresh_token) WHERE (refresh_token IS NOT NULL);


--
-- TOC entry 4921 (class 2620 OID 32837)
-- Name: diversifikasi_pm update_diversifikasi_pm_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_diversifikasi_pm_updated_at BEFORE UPDATE ON public.diversifikasi_pm FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4922 (class 2620 OID 32838)
-- Name: diversifikasi_produk_pm update_diversifikasi_produk_pm_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_diversifikasi_produk_pm_updated_at BEFORE UPDATE ON public.diversifikasi_produk_pm FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4923 (class 2620 OID 32854)
-- Name: master_items_pm update_master_items_pm_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_master_items_pm_updated_at BEFORE UPDATE ON public.master_items_pm FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4918 (class 2620 OID 16470)
-- Name: master_items update_master_items_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_master_items_updated_at BEFORE UPDATE ON public.master_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4920 (class 2620 OID 16562)
-- Name: master_products update_master_products_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_master_products_updated_at BEFORE UPDATE ON public.master_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4919 (class 2620 OID 16471)
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4916 (class 2606 OID 32789)
-- Name: diversifikasi_pm diversifikasi_pm_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diversifikasi_pm
    ADD CONSTRAINT diversifikasi_pm_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.diversifikasi_pm(id) ON DELETE SET NULL;


--
-- TOC entry 4915 (class 2606 OID 24664)
-- Name: diversifikasi_produk diversifikasi_produk_diversifikasi_rm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diversifikasi_produk
    ADD CONSTRAINT diversifikasi_produk_diversifikasi_rm_id_fkey FOREIGN KEY (diversifikasi_rm_id) REFERENCES public.diversifikasi_rm(id) ON DELETE CASCADE;


--
-- TOC entry 4917 (class 2606 OID 32827)
-- Name: diversifikasi_produk_pm diversifikasi_produk_pm_diversifikasi_pm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diversifikasi_produk_pm
    ADD CONSTRAINT diversifikasi_produk_pm_diversifikasi_pm_id_fkey FOREIGN KEY (diversifikasi_pm_id) REFERENCES public.diversifikasi_pm(id) ON DELETE CASCADE;


--
-- TOC entry 4914 (class 2606 OID 24628)
-- Name: diversifikasi_rm diversifikasi_rm_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.diversifikasi_rm
    ADD CONSTRAINT diversifikasi_rm_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.diversifikasi_rm(id) ON DELETE SET NULL;


-- Completed on 2026-05-18 09:10:58

--
-- PostgreSQL database dump complete
--

\unrestrict tp4s7CtW0c4hmCtuCotrLWQlfdstTH0Djt7tS4jkHUHMKCtcNpsvPPVVQcAx2bb

INSERT INTO users (name, email, password, password_encoded, division)
VALUES (
  'Admin',
  'admin@gmail.com',
  '$2b$12$cnC4PghxwwqOdXY0sNXBx.QAGU0kwO38byC9PpK5nO4nTej6n9nJC',
  '$2b$12$cnC4PghxwwqOdXY0sNXBx.QAGU0kwO38byC9PpK5nO4nTej6n9nJC',
  'Admin'
);

INSERT INTO master_products (kode_produk) VALUES
('PEBJ3 - Cikarang'),
('PENT1 - Cikarang'),
('PEBK1 - Cikarang'),
('PEMA2 - Cikarang'),
('PEGA2 - Cikarang'),
('PEGM1 - Cikarang'),
('PEOM1 - Cikarang'),
('PFSK1 - Cikarang'),
('PBSJ1 - Cikarang'),
('LEXU1 - Cikarang'),
('WEGM1 - Cikarang'),
('WEMA2 - Cikarang'),
('WEBJ3 - Cikarang'),
('PEGM1 - SAF'),
('PEMA2 - SAF')
ON CONFLICT (kode_produk) DO NOTHING;

INSERT INTO master_items (kode_item, nama_material, manufacture) VALUES
    ('1AA002000', 'ALOE VERA FOLIUM DRY EXTRACT', 'Sari Alam Sukabumi, PT'),
    ('1AA007000', 'ACTINIDIA GLAUCOPHYLLA FRUCTUS DE', 'Shaanxi Jiahe Phytochem Co Ltd'),
    ('1AC001000', 'CAFFEINE ANHYDROUS', 'CSPC Innovation Pharm'),
    ('1AC001000', 'CAFFEINE ANHYDROUS', 'AARTI PHARMALABS LIMITED'),
    ('1AC001000SA', 'CAFFEINE ANHYDROUS', 'CSPC Innovation Pharm'),
    ('1AC002000', 'CALCIUM CARBONATE (LIGHT)', 'Konoshima Chemical Co., Ltd.'),
    ('1AC005000', 'CURCUMA DOMESTICA RHIZOMA DRY EXTRACT', 'Phytochemindo Reksa, PT'),
    ('1AC010000', 'CALCIUM CARBONATE GRANULAR', 'Sudeep Pharma Pvt. Ltd.'),
    ('1AC012000', 'CITRUS AURANTIFOLIA FRUCTUS DRY EXTRACT', 'Phytochemindo Reksa, PT'),
    ('1AC012000', 'CITRUS AURANTIFOLIA FRUCTUS DRY EXTRACT', 'Natrindo Surya Prima, PT'),
    ('1AC013000KM', 'COFFEE ARABICA SEMEN DRY EXTRACT', 'ZHEJIANG SKYHERB BIOTECHNOLOGY'),
    ('1AE003000', 'ECHINACEAE PURPUREA HERBA EXTRACT', 'Dalian Hongjiu Biotech Co.,Ltd'),
    ('1AE003000', 'ECHINACEAE PURPUREA HERBA EXTRACT', 'Nutrafur, S.A'),
    ('1AF003000', 'FISH COLLAGEN PEPTIDES', 'Vinh Hoan Collagen'),
    ('1AF0030000', 'FISH COLLAGEN PEPTIDES', NULL),
    ('1AG004000', 'GLUCOSAMINE HYDROCHLORIDE', 'Wellable Group Marine Bio&Chem'),
    ('1AI001000', 'IMPERATA CYLINDRICA RHIZOMA DRY EXTRACT', 'Natrindo Surya Prima, PT'),
    ('1AM009000', 'MIXED BERRIES JUICE POWDER', 'Wen Lan (Legend Nutraceutical)'),
    ('1AO002000', 'OCIMUM BASILICUM B', 'Natrindo Surya Prima, PT'),
    ('1AO003000', 'OLEA EUROPAEA FRUIT DRY EXTRACT', 'Nutrafur, S.A'),
    ('1AO0030000', 'OLEA EUROPAEA FRUIT DRY EXTRACT', NULL),
    ('1AP008000KM', 'PANAX GINSENG RADIX DRY EXTRACT (6:1)', 'XI''AN DAY NATURAL INC.'),
    ('1AP009000', 'PANAX GINSENG RADIX DRY EXTRACT (10:1)', 'Jilin Province Hongjiu Biotech'),
    ('1AP009000', 'PANAX GINSENG RADIX DRY EXTRACT (10:1)', 'Hunan Huacheng Biotech, Inc'),
    ('1AP009000SA', 'PANAX GINSENG RADIX DRY EXTRACT (10:1)', 'Jilin Province Hongjiu Biotech'),
    ('1AP009000SA', 'PANAX GINSENG RADIX DRY EXTRACT (10:1)', 'Hunan Huacheng Biotech, Inc'),
    ('1AP013000', 'PAULLINIA CUPANA SEMEN DE (CAFF 22-26%)', 'Centroflora (G Nutra Ind)'),
    ('1AR001000', 'ROYAL JELLY POWDER', 'Dalian Tianshan Industrial'),
    ('1AR001000', 'ROYAL JELLY POWDER', 'Huisong Pharmaceuticals'),
    ('1AR001000SA', 'ROYAL JELLY POWDER', 'Dalian Tianshan Industrial'),
    ('1AR001000SA', 'ROYAL JELLY POWDER', 'Huisong Pharmaceuticals'),
    ('1AT001000SA', 'TAURINE', 'Hubei Grand Life Science &Tech'),
    ('1AT001000SA', 'TAURINE', 'Qianjiang Yongan Pharm'),
    ('1AT005000', 'TAMARINDUS INDICA FRUCTUS DRY EXTRACT', 'Phytochemindo Reksa, PT'),
    ('1AV005000', 'VITAMIN B2 (RIBOFLAVIN) SODIUM PHOSPHATE', 'Hubei Guangji Pharm. Co., Ltd.'),
    ('1AV006000', 'VITAMIN B3 (NICOTINAMIDE)', 'Lasons India Pvt., Ltd.'),
    ('1AV006000', 'VITAMIN B3 (NICOTINAMIDE)', 'Western Drugs Ltd.'),
    ('1AV006000SA', 'VITAMIN B3 (NICOTINAMIDE)', 'Lasons India Pvt., Ltd.'),
    ('1AV006000SA', 'VITAMIN B3 (NICOTINAMIDE)', 'Western Drugs Ltd.'),
    ('1AV008000', 'VITAMIN B5 (CALCIUM PANTOTHENATE)', 'BASF SE - Germany'),
    ('1AV008000', 'VITAMIN B5 (CALCIUM PANTOTHENATE)', 'Hangzhou Xinfu Science & Tech.'),
    ('1AV010000', 'VITAMIN B6 HCL (PYRIDOXINE HCL)', 'Jiangxi Tianxin Pharmaceutical'),
    ('1AV010000', 'VITAMIN B6 HCL (PYRIDOXINE HCL)', 'Huazhong Pharmaceutical Co Ltd'),
    ('1AV010000SA', 'VITAMIN B6 HCL (PYRIDOXINE HCL)', 'Jiangxi Tianxin Pharmaceutical'),
    ('1AV010000SA', 'VITAMIN B6 HCL (PYRIDOXINE HCL)', 'Huazhong Pharmaceutical Co Ltd'),
    ('1AV012000', 'VITAMIN B8 (INOSITOL)', 'Hebei Yuwei Biotechnology'),
    ('1AV012000', 'VITAMIN B8 (INOSITOL)', 'Zhucheng Haotian Pharm'),
    ('1AV013000', 'VITAMIN B9 (FOLIC ACID)', 'Hebei Jiheng Pharmaceutical'),
    ('1AV015000', 'VITAMIN B12 (CYANOCOBALAMIN) 0.1% WS', 'BASF A/S Denmark'),
    ('1AV015000', 'VITAMIN B12 (CYANOCOBALAMIN) 0.1% WS', 'SUPREEM PHARMACEUTICAL MYSORE'),
    ('1AV015000SA', 'VITAMIN B12 (CYANOCOBALAMIN) 0.1% WS', 'BASF A/S Denmark'),
    ('1AV016000', 'VITAMIN C (ASCORBIC ACID)', 'Shandong Luwei Pharmaceutical'),
    ('1AV016000', 'VITAMIN C (ASCORBIC ACID)', 'CSPC Weisheng (Shijiazhuang )'),
    ('1AV016000', 'VITAMIN C (ASCORBIC ACID)', 'DSM Jiangshan (Jiangsu)'),
    ('1AV018000', 'VITAMIN E (TOCOPHEROL) 50% POWDER', 'DSM Nutritional Products Ltd.'),
    ('1AV020000', 'VITEX AGNUS CASTUS FRUC DE AGNUSIDE 0.5%', 'Biosearch Life Exxentia'),
    ('1AV022000', 'VITAMIN D3 (CHOLECALCIFEROL) 100 GFP', 'BASF A/S Denmark'),
    ('1AZ001000', 'ZINC GLUCONATE', 'Purac Biochem Bv.'),
    ('1AZ006000', 'ZINGIBER OFF.VAR RUBRUM RHIZOME PE 701', 'Indesso Aroma, PT'),
    ('1RM001000', 'BAHAN BAKU', 'BASF Hongkong Ltd'),
    ('1RM001000', 'BAHAN BAKU', 'DFE Pharma GmbH & Co. KG'),
    ('1RM002000', 'RM Musnah Toll', NULL),
    ('2AA001000', 'ACESULFAME-K', 'Anhui Jinhe Industrial'),
    ('2AA001000', 'ACESULFAME-K', 'Hebei Huayang Bio. Tech.'),
    ('2AA001000SA', 'ACESULFAME-K', 'Anhui Jinhe Industrial'),
    ('2AA001000SA', 'ACESULFAME-K', 'Hebei Huayang Bio. Tech.'),
    ('2AA002000', 'ASPARTAME', 'Nantong Changhai Food Additive'),
    ('2AA002000', 'ASPARTAME', 'Ajinomoto Co., Inc.'),
    ('2AA002000SA', 'ASPARTAME', 'Nantong Changhai Food Additive'),
    ('2AA002000SA', 'ASPARTAME', 'Ajinomoto Co., Inc.'),
    ('2AA003000', 'ALKOHOL', 'Molindo Raya Industrial, PT'),
    ('2AA003000', 'ALKOHOL', 'Karsavicta Satya, PT.'),
    ('2AB002000', 'BRILLIANT BLUE FCF (FD&C BLUE NO.1)', 'Sensient Colors LLC'),
    ('2AB002000', 'BRILLIANT BLUE FCF (FD&C BLUE NO.1)', 'Univar Ltd.'),
    ('2AC001000', 'CARMOISINE (E122)', 'Sensient Colors S.A.DE.C.V'),
    ('2AC001000', 'CARMOISINE (E122)', 'Univar Ltd.'),
    ('2AC001000', 'CARMOISINE (E122)', 'Ajanta Chemical Industries'),
    ('2AC001000SA', 'CARMOISINE (E122)', 'Sensient Colors S.A.DE.C.V'),
    ('2AC001000SA', 'CARMOISINE (E122)', 'Univar Ltd.'),
    ('2AC001000SA', 'CARMOISINE (E122)', 'Ajanta Chemical Industries'),
    ('2AC002000', 'CARAMEL COLOUR (E150)', 'Sethness Product Co.'),
    ('2AC006000', 'CITRIC ACID ANHYDROUS', 'RZBC (Juxian) Co., Ltd.'),
    ('2AC006000', 'CITRIC ACID ANHYDROUS', 'Shandong Ensign Industry'),
    ('2AC006000J', 'CITRIC ACID ANHYDROUS', 'RZBC (Juxian) Co., Ltd.'),
    ('2AC006000J', 'CITRIC ACID ANHYDROUS', 'Shandong Ensign Industry'),
    ('2AC006000SA', 'CITRIC ACID ANHYDROUS', 'Shandong Ensign Industry'),
    ('2AC006000SA', 'CITRIC ACID ANHYDROUS', 'RZBC (Juxian) Co., Ltd.'),
    ('2AG002000', 'GRAPE SHADE R SD (FD&C Red#40 & Blue#1)', 'Sensient Colors LLC'),
    ('2AG002000SA', 'GRAPE SHADE R SD (FD&C Red#40 & Blue#1)', 'Sensient Colors LLC'),
    ('2AM004000', 'MALIC ACID', 'Yongsan Chemicals Inc.'),
    ('2AM004000', 'MALIC ACID', 'Fuso Chemical Co., Ltd.'),
    ('2AM004000SA', 'MALIC ACID', 'Yongsan Chemicals Inc.'),
    ('2AM004000SA', 'MALIC ACID', 'Fuso Chemical Co., Ltd.'),
    ('2AN002000', 'NON DAIRY CREAMER LK 32 CA', 'Lautan Natural Krimerindo, PT'),
    ('2AP001000SA', 'PATENT BLUE V (E131)', 'Sensient Colors UK Ltd.'),
    ('2AP001000SA', 'PATENT BLUE V (E131)', 'Univar Ltd.'),
    ('2AP002000', 'PONCEAU 4R (E124)', 'Sensient Colors S.A.DE.C.V'),
    ('2AP002000', 'PONCEAU 4R (E124)', 'Univar Ltd.'),
    ('2AP011000', 'POVIDONE K-30', 'Ashland (ISP Chemical LLC)'),
    ('2AS001000', 'SUNSET YELLOW FCF (E110)', 'Sensient Colors S.A.DE.C.V'),
    ('2AS001000', 'SUNSET YELLOW FCF (E110)', 'Univar Ltd.'),
    ('2AS001000', 'SUNSET YELLOW FCF (E110)', 'Ajanta Chemical Industries'),
    ('2AS001000SA', 'SUNSET YELLOW FCF (E110)', 'Univar Ltd.'),
    ('2AS001000SA', 'SUNSET YELLOW FCF (E110)', 'Sensient Colors S.A.DE.C.V'),
    ('2AS001000SA', 'SUNSET YELLOW FCF (E110)', 'Ajanta Chemical Industries'),
    ('2AS004000', 'SUCRALOSE', 'Anhui Jinhe Industrial'),
    ('2AS004000', 'SUCRALOSE', 'Nantong Changhai Food Additive'),
    ('2AS004000', 'SUCRALOSE', 'JK Sucralose Inc.'),
    ('2AS005000', 'SODIUM BENZOATE', 'Emerald Kalama Chemical, B.V.'),
    ('2AS005000', 'SODIUM BENZOATE', 'Wuhan Youji Industries'),
    ('2AS006000', 'SODIUM BICARBONATE', 'Qingdao Soda Ash Ind Dev'),
    ('2AS006000', 'SODIUM BICARBONATE', 'Guangzhou Nanxian Chemical'),
    ('2AS006000J', 'SODIUM BICARBONATE', 'Guangzhou Nanxian Chemical'),
    ('2AS006000J', 'SODIUM BICARBONATE', 'Church & Dwight Co., Inc.'),
    ('2AS006000SA', 'SODIUM BICARBONATE', 'Guangzhou Nanxian Chemical'),
    ('2AS007000', 'SODIUM CHLORIDE', 'Dominion Salt Limited'),
    ('2AS007000', 'SODIUM CHLORIDE', 'Karya Daya Syafarmasi, PT'),
    ('2AS007000SA', 'SODIUM CHLORIDE', 'Dominion Salt Limited'),
    ('2AS007000SA', 'SODIUM CHLORIDE', 'Karya Daya Syafarmasi, PT'),
    ('2AS008000', 'SODIUM CITRATE', 'RZBC (Juxian) Co., Ltd.'),
    ('2AS008000', 'SODIUM CITRATE', 'Shandong Ensign Industry'),
    ('2AS010000', 'SODIUM CYCLAMATE', 'Wihadil, PT'),
    ('2AS010000', 'SODIUM CYCLAMATE', 'Golden Time Chemical (Jiangsu)'),
    ('2AS012000', 'SUCROSE (GULA PASIR)', 'Sugar Labinta, PT'),
    ('2AS012000', 'SUCROSE (GULA PASIR)', 'Jawamanis Rafinasi, PT'),
    ('2AS012000', 'SUCROSE (GULA PASIR)', 'Permata Dunia Sukses Utama, PT'),
    ('2AS012000', 'SUCROSE (GULA PASIR)', 'PT. Angels Products'),
    ('2AS012000KM', 'SUCROSE (GULA PASIR)', 'Jawamanis Rafinasi, PT'),
    ('2AS012000KM', 'SUCROSE (GULA PASIR)', 'Permata Dunia Sukses Utama, PT'),
    ('2AS012000KM', 'SUCROSE (GULA PASIR)', 'PT. Angels Products'),
    ('2AS018000', 'SKIM MILK POWDER', 'Saputo Dairy Australia Pty Ltd'),
    ('2AS018000', 'SKIM MILK POWDER', 'California Dairies Inc-Visalia'),
    ('2AS019000', 'SODIUM SACCHARIN ANHYDROUS', 'Kaifeng Xinhua Fine Chemical'),
    ('2AT001000', 'TARTRAZINE (E102)', 'Sensient Colors S.A.DE.C.V'),
    ('2AT001000', 'TARTRAZINE (E102)', 'Univar Ltd.'),
    ('2AX001000', 'XANTHAN GUM', 'Deosen Biochemical (Ordos) Ltd'),
    ('2AX001000SA', 'XANTHAN GUM', 'Deosen Biochemical (Ordos) Ltd'),
    ('3AB001000', 'BEVERAGE CLOUD 862574P', 'Firmenich - Indonesia'),
    ('3AB001000SA', 'BEVERAGE CLOUD 862574P', 'Firmenich - Indonesia'),
    ('3AB002000', 'BLACKCURRANT MICRON S1303309', 'Takasago International(S) Pte.'),
    ('3AB002000', 'BLACKCURRANT MICRON S1303309', 'PT. Takasago Int. Indonesia'),
    ('3AB002000SA', 'BLACKCURRANT MICRON S1303309', 'Takasago International(S) Pte.'),
    ('3AB002000SA', 'BLACKCURRANT MICRON S1303309', 'PT. Takasago Int. Indonesia'),
    ('3AB004000', 'BLACKCURRANT GRAPE EF100 FLV S-376765', 'Givaudan Indonesia, PT.'),
    ('3AB005000', 'BLACKCURRANT DURAROME 860349 TDB0594', 'Firmenich - Indonesia'),
    ('3AC007000', 'COLA MICRON S1303312', 'Takasago International(S) Pte.'),
    ('3AC007000SA', 'COLA MICRON S1303312', 'Takasago International(S) Pte.'),
    ('3AC008000', 'CREAMY MOUTHFEEL SC220349', 'IFF-PT.Essence Indonesia (Kwg)'),
    ('3AC009000', 'COLA FLAVOUR S-376116', 'Givaudan Indonesia, PT.'),
    ('3AE002000', 'EVERFRESH', 'Givaudan - Indonesia'),
    ('3AG009000', 'GRAPE FLAVOR SC302289', 'IFF-PT.Essence Indonesia (Kwg)'),
    ('3AG009000SA', 'GRAPE FLAVOR SC302289', 'IFF-PT.Essence Indonesia (Kwg)'),
    ('3AG010000', 'GRAPE EF 100 FLAVOUR S-167184', 'Givaudan - Switzerland'),
    ('3AG010000SA', 'GRAPE EF 100 FLAVOUR S-167184', 'Givaudan - Switzerland'),
    ('3AG011000', 'GINGER FRESHLY GROUND SC764895', 'IFF-PT.Essence Indonesia (Kwg)'),
    ('3AG012000', 'GINGER SC764916', 'IFF-PT.Essence Indonesia (Kwg)'),
    ('3AG013000', 'GRAPE FLAVOR 050014 1107TP0954', 'Firmenich Ind. (Indesso Aroma)'),
    ('3AK001000', 'KEDONDONG SC777429', 'IFF-PT.Essence Indonesia (Kwg)'),
    ('3AL004000', 'LEMON LIME DURAROME FLAVOR 860467 TD0990', 'Firmenich - Indonesia'),
    ('3AL008000', 'LIME DURAROME 860234 TD0991', 'Firmenich - Indonesia'),
    ('3AL010000', 'LYCHEE MICRON S1712459', 'Takasago International(S) Pte.'),
    ('3AM003000', 'MIXED FRUIT DURAROME 858400 TDI 0594', 'Firmenich - USA'),
    ('3AM003000', 'MIXED FRUIT DURAROME 858400 TDI 0594', 'Firmenich - Indonesia'),
    ('3AM004000', 'MIXED FRUIT FLAVOUR Q-127339', 'Givaudan - Indonesia'),
    ('3AM009000', 'MANGO DURAROME 858 252 TD0994', 'Firmenich - Indonesia'),
    ('3AM009000SA', 'MANGO DURAROME 858 252 TD0994', 'Firmenich - Indonesia'),
    ('3AM010000', 'MANGO SN 932213', 'IFF-PT.Essence Indonesia (Kwg)'),
    ('3AM010000', 'MANGO SN 932213', 'IFF - Indonesia'),
    ('3AM010000SA', 'MANGO SN 932213', 'IFF-PT.Essence Indonesia (Kwg)'),
    ('3AM010000SA', 'MANGO SN 932213', 'IFF - Indonesia'),
    ('3AM012000', 'MILK EF 100 S-275223', 'Givaudan Indonesia, PT.'),
    ('3AM014000', 'MANGO DURAROME 861108 TD1022', 'Firmenich - Indonesia'),
    ('3AM015000', 'MANGO DURAROME 861305 TD1094', 'Firmenich - Indonesia'),
    ('3AM016000KM', 'MIXED FRUIT FLV L-465907', 'Givaudan Indonesia, PT.'),
    ('3AO009000', 'ORANGE DURAROME FLAVOR 861341 TD 0594', 'Firmenich - Indonesia'),
    ('3AP004000KM', 'PINEAPPLE FLAVOUR 76136-33', 'Givaudan Indonesia, PT.'),
    ('3AR002000', 'RASPBERRY DURAROME 861541TD0594', 'Firmenich - Indonesia'),
    ('3AT002000', 'TAMARIND DURAROME FLAVOR 861448 TD0594', 'Firmenich - USA'),
    ('3AV001000', 'VANILLA SC298065', 'IFF-PT.Essence Indonesia (Kwg)'),
    ('3AY001000', 'YOGHURT SC1009872', 'IFF-PT.Essence Indonesia (Kwg)')
ON CONFLICT (kode_item, manufacture) DO NOTHING;


INSERT INTO master_items_pm (kode_item, nama_material, manufacture) VALUES
    ('1FE001010', 'FOIL EXTRA JOSS ACTIVE B7 EXP/720x750', 'SUPERNOVA FLEXIBLE PACK, PT'),
    ('1FE002010', 'FOIL EXTRA JOSS MANGGA MAL/160x1000', 'INDOGRAVURE, PT'),
    ('1FE002010', 'FOIL EXTRA JOSS MANGGA MAL/160x1000', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE002020', 'FOIL EXTRA JOSS MANGGA MAL/160x1000', 'INDOGRAVURE, PT'),
    ('1FE003010', 'FOIL EXTRA JOSS ANGGUR MAL/160x1000', 'INDOGRAVURE, PT'),
    ('1FE003020', 'FOIL EXTRA JOSS ANGGUR MAL/160x1000', 'INDOGRAVURE, PT'),
    ('1FE006020', 'FOIL EXTRA JOSS FRONT/624x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE006030', 'FOIL EXTRA JOSS FRONT/624x750', ''),
    ('1FE007020', 'FOIL EXTRA JOSS BACK/624x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE007030', 'FOIL EXTRA JOSS BACK/624x750', ''),
    ('1FE008010', 'FOIL EXTRA JOSS ACTIVE B7/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE008010', 'FOIL EXTRA JOSS ACTIVE B7/720x750', 'AVESTA CONTINENTAL PACK, PT'),
    ('1FE008010', 'FOIL EXTRA JOSS ACTIVE B7/720x750', 'SUPERNOVA FLEXIBLE PACK, PT'),
    ('1FE008020', 'FOIL EXTRA JOSS ACTIVE B7/720x750', 'SUPERNOVA FLEXIBLE PACK, PT'),
    ('1FE008040', 'FOIL EXTRA JOSS ACTIVE B7/720x750', ''),
    ('1FE013000', 'FOIL EXTRA JOSS MANGO MYN/160x1000', 'INDOGRAVURE, PT'),
    ('1FE016000', 'FOIL EXTRA JOSS MANGGA MAL/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE016000', 'FOIL EXTRA JOSS MANGGA MAL/720x750', 'INDOGRAVURE, PT'),
    ('1FE018000', 'FOIL EXTRA JOSS GRAPE PH/160x1000', 'INDOGRAVURE, PT'),
    ('1FE018000', 'FOIL EXTRA JOSS GRAPE PH/160x1000', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE018010', 'FOIL EXTRA JOSS GRAPE PH/160x1000', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE019000', 'FOIL EXTRA JOSS ACTIVE B7 EXP/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE020000', 'FOIL EXTRA JOSS GO RASA ANGGUR/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE021000', 'FOIL EXTRA JOSS GO RASA MANGGA/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE022000', 'FOIL EXTRA JOSS ANGGUR MAL /720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE022000', 'FOIL EXTRA JOSS ANGGUR MAL /720x750', 'INDOGRAVURE, PT'),
    ('1FE023010', 'FOIL EXTRA JOSS ACTIVE KOR/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE024000', 'FOIL EXTRA JOSS ACTIVE TAW/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE025000', 'FOIL EXTRA JOSS MANGO PH/160x1000', 'INDOGRAVURE, PT'),
    ('1FE026000', 'FOIL EXTRA JOSS GO RASA MANGGA/160x1000', 'INDOGRAVURE, PT'),
    ('1FE027000', 'FOIL EXTRA JOSS ANGGUR MAL/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE028000', 'FOIL EXTRA JOSS MANGGA MAL/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE029000', 'FOIL EXTRA JOSS ACTIVE B7 EXP/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE029010', 'FOIL EXTRA JOSS ACTIVE B7 EXP/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE030000', 'FOIL EXTRA JOSS MANGGA MAL/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE030000', 'FOIL EXTRA JOSS MANGGA MAL/720x750', 'INDOGRAVURE, PT'),
    ('1FE030010', 'FOIL EXTRA JOSS MANGGA MAL/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE031000', 'FOIL EXTRA JOSS ANGGUR MAL /720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE031010', 'FOIL EXTRA JOSS ANGGUR MAL /720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE033000', 'FOIL EXTRA JOSS ANGGUR MAL/160x1000', 'INDOGRAVURE, PT'),
    ('1FE033000', 'FOIL EXTRA JOSS ANGGUR MAL/160x1000', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE033010', 'FOIL EXTRA JOSS ANGGUR MAL/160x1000', 'INDOGRAVURE, PT'),
    ('1FE033010', 'FOIL EXTRA JOSS ANGGUR MAL/160x1000', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE034000', 'FOIL EXTRA JOSS MANGGA MAL/160x1000', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE034010', 'FOIL EXTRA JOSS MANGGA MAL/160x1000', 'INDOGRAVURE, PT'),
    ('1FE034010', 'FOIL EXTRA JOSS MANGGA MAL/160x1000', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE036000', 'FOIL EXTRA JOSS ACTIVE B7/720x750', 'SUPERNOVA FLEXIBLE PACK, PT'),
    ('1FE036000', 'FOIL EXTRA JOSS ACTIVE B7/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE036010', 'FOIL EXTRA JOSS ACTIVE B7/720x750', 'SUPERNOVA FLEXIBLE PACK, PT'),
    ('1FE036010', 'FOIL EXTRA JOSS ACTIVE B7/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE037000', 'FOIL EXTRA JOSS FRONT/624x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE037010', 'FOIL EXTRA JOSS FRONT/624x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE038000', 'FOIL EXTRA JOSS BACK/624x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE038010', 'FOIL EXTRA JOSS BACK/624x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE039000', 'FOIL EXTRA JOSS ORANGE MAL/720x750', 'SUPERNOVA FLEXIBLE PACK, PT'),
    ('1FE043000', 'FOIL EXTRA JOSS GO RASA ANGGUR/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE046030', 'FOIL EXTRA JOSS ACTIVE MAL/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE046030', 'FOIL EXTRA JOSS ACTIVE MAL/720x750', 'INDOGRAVURE, PT'),
    ('1FE046040', 'FOIL EXTRA JOSS ACTIVE MAL/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE046040', 'FOIL EXTRA JOSS ACTIVE MAL/720x750', 'INDOGRAVURE, PT'),
    ('1FE046050', 'FOIL EXTRA JOSS ACTIVE MAL/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE049000', 'FOIL EXTRA JOSS GO RASA MANGGA/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FE057070', 'FOIL EXTRA JOSS ACTIVE B7 MYN/720x750', 'INDOGRAVURE, PT'),
    ('1FE065030', 'FOIL EXTRA JOSS GRAPE EXP/160x1000', 'INDOGRAVURE, PT'),
    ('1FF002000', 'FOIL FEMMY SKIN/792x1000', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FF003000', 'FOIL FEMMY ACTIVE/792x1000', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FF005000', 'FOIL FEMMY MENSANA/792x1000', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FF006000', 'FOIL FEMMY ESTROCAL/792x1000', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FF008000', 'FOIL FEMMY ESTROCAL/792x1000', ''),
    ('1FJ001020', 'FOIL BEJO SUJAMER/888x1000', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FS001000', 'FOIL B7 SLA-SI JERUK NIPIS/720x750', 'SUPERNOVA FLEXIBLE PACK, PT'),
    ('1FS001000', 'FOIL B7 SLA-SI JERUK NIPIS/720x750', 'AVESTA CONTINENTAL PACK, PT'),
    ('1FS001000', 'FOIL B7 SLA-SI JERUK NIPIS/720x750', 'PANVERTA CAKRAKENCANA, PT'),
    ('1FS001010', 'FOIL B7 SLA-SI JERUK NIPIS/720x750', 'SUPERNOVA FLEXIBLE PACK, PT'),
    ('1FS001020', 'FOIL B7 SLA-SI JERUK NIPIS/720x750', 'SUPERNOVA FLEXIBLE PACK, PT'),
    ('1FS001030', 'FOIL B7 SLA-SI JERUK NIPIS/720x750', ''),
    ('1PM001000', 'PM MUSNAH TOLL', ''),
    ('1WE005000', 'CAN EXTRA JOSS ULTIMATE/167.3x124.7', ''),
    ('1WE006000', 'LID EXTRA JOSS ULTIMATE', ''),
    ('1WE007000', 'CAN LID EXTRA JOSS ULTIMATE/167.3x124.7', 'UNITED CAN COMPANY, PT'),
    ('1WE008000', 'CAN LID EXTRA JOSS ULTIMATE/167.3x129', 'UNITED CAN COMPANY, PT'),
    ('1WE008010', 'CAN LID EXTRA JOSS ULTIMATE/167.3x129', 'UNITED CAN COMPANY, PT'),
    ('1WE009000', 'CAN LID EXTRA JOSS ULTIMATE MAL/167.3x129', 'UNITED CAN COMPANY, PT'),
    ('2DE001010', 'PACK EXTRA JOSS ACTIVE B7 EXP/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE001010', 'PACK EXTRA JOSS ACTIVE B7 EXP/62x24x82', 'CITRA SASTRA GRAFIKA, PT'),
    ('2DE002010', 'PACK EXTRA JOSS MANGGA MAL/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE002010', 'PACK EXTRA JOSS MANGGA MAL/62x24x82', 'CITRA SASTRA GRAFIKA, PT'),
    ('2DE003010', 'PACK EXTRA JOSS ANGGUR MAL/62x24x82', 'CITRA SASTRA GRAFIKA, PT'),
    ('2DE003010', 'PACK EXTRA JOSS ANGGUR MAL/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE003010', 'PACK EXTRA JOSS ANGGUR MAL/62x24x82', 'CAHAYA ABADI GRAFIKA, PT'),
    ('2DE008010', 'PACK EXTRA JOSS ACTIVE (ISI 6)/62x24x82', 'CITRA SASTRA GRAFIKA, PT'),
    ('2DE008010', 'PACK EXTRA JOSS ACTIVE (ISI 6)/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE008020', 'PACK EXTRA JOSS ACTIVE (ISI 6)/62x24x82', ''),
    ('2DE008030', 'PACK EXTRA JOSS ACTIVE (ISI 6)/62x24x82', ''),
    ('2DE009010', 'PACK EXTRA JOSS ACTIVE (ISI 12)/82x42x62', 'CITRA SASTRA GRAFIKA, PT'),
    ('2DE009010', 'PACK EXTRA JOSS ACTIVE (ISI 12)/82x42x62', 'GUNUNG KELUD WISESA, PT'),
    ('2DE009010', 'PACK EXTRA JOSS ACTIVE (ISI 12)/82x42x62', 'CAHAYA ABADI GRAFIKA, PT'),
    ('2DE009020', 'PACK EXTRA JOSS ACTIVE (ISI 12)/82x42x62', ''),
    ('2DE009030', 'PACK EXTRA JOSS ACTIVE (ISI 12)/82x42x62', ''),
    ('2DE018000', 'PACK EXTRA JOSS GRAPE PH/62x24x82', 'CITRA SASTRA GRAFIKA, PT'),
    ('2DE018000', 'PACK EXTRA JOSS GRAPE PH/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE018000', 'PACK EXTRA JOSS GRAPE PH/62x24x82', 'CAHAYA ABADI GRAFIKA, PT'),
    ('2DE018010', 'PACK EXTRA JOSS GRAPE PH/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE018020', 'PACK EXTRA JOSS GRAPE PH/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE019000', 'PACK EXTRA JOSS MANGGA MAL/62x24x82', 'CITRA SASTRA GRAFIKA, PT'),
    ('2DE020000', 'PACK EXTRA JOSS ACTIVE B7 EXP/62x24x82', 'CITRA SASTRA GRAFIKA, PT'),
    ('2DE020000', 'PACK EXTRA JOSS ACTIVE B7 EXP/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE021000', 'PACK EXTRA JOSS GO RASA ANGGUR/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE021000', 'PACK EXTRA JOSS GO RASA ANGGUR/62x24x82', 'CAHAYA ABADI GRAFIKA, PT'),
    ('2DE021000', 'PACK EXTRA JOSS GO RASA ANGGUR/62x24x82', 'CITRA SASTRA GRAFIKA, PT'),
    ('2DE022000', 'PACK EXTRA JOSS GO RASA MANGGA/62x24x82', 'CAHAYA ABADI GRAFIKA, PT'),
    ('2DE022000', 'PACK EXTRA JOSS GO RASA MANGGA/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE023000', 'PACK EXTRA JOSS ANGGUR MAL/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE023000', 'PACK EXTRA JOSS ANGGUR MAL/62x24x82', 'CITRA SASTRA GRAFIKA, PT'),
    ('2DE024010', 'PACK EXTRA JOSS ACTIVE KOR /62x24x82', 'CITRA SASTRA GRAFIKA, PT'),
    ('2DE024010', 'PACK EXTRA JOSS ACTIVE KOR /62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE027000', 'PACK EXTRA JOSS ACTIVE TAW/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE028000', 'PACK EXTRA JOSS MANGO PH/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE031000', 'PACK EXTRA JOSS GO RASA MANGGA/62x24x82', 'CAHAYA ABADI GRAFIKA, PT'),
    ('2DE031000', 'PACK EXTRA JOSS GO RASA MANGGA/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE034000', 'PACK EXTRA JOSS ANGGUR MAL/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE035000', 'PACK EXTRA JOSS MANGGA MAL/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE036000', 'PACK EXTRA JOSS MANGGA MAL/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE036010', 'PACK EXTRA JOSS MANGGA MAL/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE037000', 'PACK EXTRA JOSS ANGGUR MAL/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE037010', 'PACK EXTRA JOSS ANGGUR MAL/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE038000', 'PACK EXTRA JOSS ACTIVE B7 EXP/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE038010', 'PACK EXTRA JOSS ACTIVE B7 EXP/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE041000', 'PACK EXTRA JOSS MANGGA MAL/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE041010', 'PACK EXTRA JOSS MANGGA MAL/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE042000', 'PACK EXTRA JOSS ANGGUR MAL/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE042010', 'PACK EXTRA JOSS ANGGUR MAL/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE044000', 'PACK EXTRA JOSS ACTIVE (ISI 6)/62x24x82', 'PENJALINDO NUSANTARA, PT'),
    ('2DE044000', 'PACK EXTRA JOSS ACTIVE (ISI 6)/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE044010', 'PACK EXTRA JOSS ACTIVE (ISI 6)/62x24x82', 'PENJALINDO NUSANTARA, PT'),
    ('2DE044010', 'PACK EXTRA JOSS ACTIVE (ISI 6)/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE045000', 'PACK EXTRA JOSS ACTIVE (ISI 12)/82x42x62', 'PENJALINDO NUSANTARA, PT'),
    ('2DE045000', 'PACK EXTRA JOSS ACTIVE (ISI 12)/82x42x62', 'GUNUNG KELUD WISESA, PT'),
    ('2DE045010', 'PACK EXTRA JOSS ACTIVE (ISI 12)/82x42x62', 'PENJALINDO NUSANTARA, PT'),
    ('2DE045010', 'PACK EXTRA JOSS ACTIVE (ISI 12)/82x42x62', 'GUNUNG KELUD WISESA, PT'),
    ('2DE045010', 'PACK EXTRA JOSS ACTIVE (ISI 12)/82x42x62', 'MEDIATAMA PERKASA, CV'),
    ('2DE047050', 'PACK EXTRA JOSS ACTIVE B7 MAL/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE047050', 'PACK EXTRA JOSS ACTIVE B7 MAL/62x24x82', 'CITRA SASTRA GRAFIKA, PT'),
    ('2DE047060', 'PACK EXTRA JOSS ACTIVE B7 MAL/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE047070', 'PACK EXTRA JOSS ACTIVE B7 MAL/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE049000', 'PACK EXTRA JOSS ORANGE MAL/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE052000', 'PACK EXTRA JOSS EXP NETHERLAND/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE053000', 'PACK EXTRA JOSS MANGO ND/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE054000', 'PACK EXTRA JOSS GRAPE ND/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE056000', 'PACK EXTRA JOSS GO RASA ANGGUR/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE058070', 'PACK EXTRA JOSS ACTIVE B7 MYN/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE058070', 'PACK EXTRA JOSS ACTIVE B7 MYN/62x24x82', 'CITRA SASTRA GRAFIKA, PT'),
    ('2DE058070', 'PACK EXTRA JOSS ACTIVE B7 MYN/62x24x82', 'CAHAYA ABADI GRAFIKA, PT'),
    ('2DE067040', 'PACK EXTRA JOSS GRAPE EXP/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE067040', 'PACK EXTRA JOSS GRAPE EXP/62x24x82', 'CITRA SASTRA GRAFIKA, PT'),
    ('2DE068020', 'PACK EXTRA JOSS MANGO MYN/62x24x82', 'CITRA SASTRA GRAFIKA, PT'),
    ('2DE068020', 'PACK EXTRA JOSS MANGO MYN/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE070000', 'PACK EXTRA JOSS GO RASA MANGGA/62x24x82', 'GUNUNG KELUD WISESA, PT'),
    ('2DE071000', 'PACK EXTRA JOSS ACTIVE (ISI 6)/62x24x82', ''),
    ('2DF004000', 'PACK FEMMY SKIN/60x55x125', 'PENJALINDO NUSANTARA, PT'),
    ('2DF004000', 'PACK FEMMY SKIN/60x55x125', 'GUNUNG KELUD WISESA, PT'),
    ('2DF005000', 'PACK FEMMY ACTIVE/55x30x125', 'PENJALINDO NUSANTARA, PT'),
    ('2DF007000', 'PACK FEMMY MENSANA/55x30x125', 'PENJALINDO NUSANTARA, PT'),
    ('2DF008000', 'PACK FEMMY ESTROCAL/60x55x125', 'PENJALINDO NUSANTARA, PT'),
    ('2DF008000', 'PACK FEMMY ESTROCAL/60x55x125', 'GUNUNG KELUD WISESA, PT'),
    ('2DJ001020', 'PACK BEJO SUJAMER/60x45x130', 'CAHAYA ABADI GRAFIKA, PT'),
    ('2DJ001020', 'PACK BEJO SUJAMER/60x45x130', 'GUNUNG KELUD WISESA, PT'),
    ('2DJ002010', 'PACK BEJO SUJAMER/90x70x130', 'CAHAYA ABADI GRAFIKA, PT'),
    ('2DS002000', 'PACK B7 SLA-SI JERUK NIPIS/65x30x95', 'PENJALINDO NUSANTARA, PT'),
    ('2DS002010', 'PACK B7 SLA-SI JERUK NIPIS/65x30x95', 'PENJALINDO NUSANTARA, PT'),
    ('2DS002020', 'PACK B7 SLA-SI JERUK NIPIS/65x30x95', 'GUNUNG KELUD WISESA, PT'),
    ('2DS002020', 'PACK B7 SLA-SI JERUK NIPIS/65x30x95', 'PENJALINDO NUSANTARA, PT'),
    ('2DS002030', 'PACK B7 SLA-SI JERUK NIPIS/65x30x95', 'PENJALINDO NUSANTARA, PT'),
    ('2DS002030', 'PACK B7 SLA-SI JERUK NIPIS/65x30x95', 'GUNUNG KELUD WISESA, PT'),
    ('3ME002160', 'KARTON EXTRA JOSS ACTIVE B7/374x256x169', 'KEDAWUNG SETIA CORRUGATED, PT'),
    ('3ME002160', 'KARTON EXTRA JOSS ACTIVE B7/374x256x169', 'RAPIPACK ASRITAMA, PT'),
    ('3ME002160', 'KARTON EXTRA JOSS ACTIVE B7/374x256x169', 'TRISTAR MAKMUR KARTONINDO, PT'),
    ('3ME002160', 'KARTON EXTRA JOSS ACTIVE B7/374x256x169', 'OJI SINAR MAS PACKAGING, PT'),
    ('3ME006000', 'KARTON JOSS 3BOOST/374x256x169', 'DAYA CIPTA KEMASINDO, PT'),
    ('3ME007000', 'KARTON JOSS 3BOOST/420x250x122', 'DAYA CIPTA KEMASINDO, PT'),
    ('3ME008000', 'KARTON JOSS 3BOOST/433x259x129', 'DAYA CIPTA KEMASINDO, PT'),
    ('3ME009000', 'KARTON JOSS C-500 MYN/433x259x129', 'DAYA CIPTA KEMASINDO, PT'),
    ('3ME010050', 'KARTON EXTRA JOSS B7 EXP/374x256x333', 'KEDAWUNG SETIA CORRUGATED, PT'),
    ('3ME010050', 'KARTON EXTRA JOSS B7 EXP/374x256x333', 'TRISTAR MAKMUR KARTONINDO, PT'),
    ('3ME010050', 'KARTON EXTRA JOSS B7 EXP/374x256x333', 'RAPIPACK ASRITAMA, PT'),
    ('3ME010050', 'KARTON EXTRA JOSS B7 EXP/374x256x333', 'OJI SINAR MAS PACKAGING, PT'),
    ('3ME010060', 'KARTON EXTRA JOSS B7 EXP/374x256x333', ''),
    ('3ME019000', 'KARTON EXTRA JOSS ULTIMATE/466x743', 'INDAH KIAT, PT'),
    ('3ME020000', 'KARTON EXTRA JOSS ACTIVE B7/433x259x129', 'OJI SINAR MAS PACKAGING, PT'),
    ('3ME020000', 'KARTON EXTRA JOSS ACTIVE B7/433x259x129', 'RAPIPACK ASRITAMA, PT'),
    ('3ME021000', 'KARTON EXTRA JOSS ACTIVE B7/374x256x169', ''),
    ('3ME022040', 'KARTON EXTRA JOSS EXP/420x248x127', 'KEDAWUNG SETIA CORRUGATED, PT'),
    ('3ME022040', 'KARTON EXTRA JOSS EXP/420x248x127', 'TRISTAR MAKMUR KARTONINDO, PT'),
    ('3ME022040', 'KARTON EXTRA JOSS EXP/420x248x127', 'RAPIPACK ASRITAMA, PT'),
    ('3ME022040', 'KARTON EXTRA JOSS EXP/420x248x127', 'OJI SINAR MAS PACKAGING, PT'),
    ('3ME023000', 'KARTON EXTRA JOSS ACTIVE B7/374x256x169', 'OJI SINAR MAS PACKAGING, PT'),
    ('3ME023000', 'KARTON EXTRA JOSS ACTIVE B7/374x256x169', 'RAPIPACK ASRITAMA, PT'),
    ('3ME024000', 'KARTON EXTRA JOSS 3 IN 1 EXP/374x256x169', 'OJI SINAR MAS PACKAGING, PT'),
    ('3ME024000SF', 'KARTON EXTRA JOSS 3 IN 1 EXP/374x256x169', 'OJI SINAR MAS PACKAGING, PT'),
    ('3ME025000', 'KARTON PREMIX/389x277x505', 'OJI SINAR MAS PACKAGING, PT'),
    ('3ME026000', 'KARTON POLOS ULTIMATE/500x450x400', 'RAPIPACK ASRITAMA, PT'),
    ('3ME027000', 'KARTON EXTRA JOSS GO/380x257x170', 'OJI SINAR MAS PACKAGING, PT'),
    ('3ME029040', 'KARTON EXTRA JOSS ACTIVE B7/433x259x129', 'DAYA CIPTA KEMASINDO, PT'),
    ('3ME029040', 'KARTON EXTRA JOSS ACTIVE B7/433x259x129', 'KEDAWUNG SETIA CORRUGATED, PT'),
    ('3ME029040', 'KARTON EXTRA JOSS ACTIVE B7/433x259x129', 'RAPIPACK ASRITAMA, PT'),
    ('3ME029040', 'KARTON EXTRA JOSS ACTIVE B7/433x259x129', 'TRISTAR MAKMUR KARTONINDO, PT'),
    ('3ME029040', 'KARTON EXTRA JOSS ACTIVE B7/433x259x129', 'OJI SINAR MAS PACKAGING, PT'),
    ('3ME032000', 'KARTON EXTRA JOSS GO/380x257x170', 'RAPIPACK ASRITAMA, PT'),
    ('3ME032000', 'KARTON EXTRA JOSS GO/380x257x170', 'OJI SINAR MAS PACKAGING, PT'),
    ('3ME032000', 'KARTON EXTRA JOSS GO/380x257x170', 'MULTIBOX INDAH, PT'),
    ('3ME032000', 'KARTON EXTRA JOSS GO/380x257x170', 'KEDAWUNG SETIA CORRUGATED, PT'),
    ('3ME032000', 'KARTON EXTRA JOSS GO/380x257x170', 'TRISTAR MAKMUR KARTONINDO, PT'),
    ('3ME032000SF', 'KARTON EXTRA JOSS GO/380x257x170', 'KEDAWUNG SETIA CORRUGATED, PT'),
    ('3ME032000SF', 'KARTON EXTRA JOSS GO/380x257x170', 'TRISTAR MAKMUR KARTONINDO, PT'),
    ('3ME032000SF', 'KARTON EXTRA JOSS GO/380x257x170', 'OJI SINAR MAS PACKAGING, PT'),
    ('3ME032000SF', 'KARTON EXTRA JOSS GO/380x257x170', 'RAPIPACK ASRITAMA, PT'),
    ('3ME032000SF', 'KARTON EXTRA JOSS GO/380x257x170', 'MULTIBOX INDAH, PT'),
    ('3ME037000SF', 'KARTON EXTRA JOSS 2 IN 1 EXP/380x257x170', 'KEDAWUNG SETIA CORRUGATED, PT'),
    ('3ME037000SF', 'KARTON EXTRA JOSS 2 IN 1 EXP/380x257x170', 'TRISTAR MAKMUR KARTONINDO, PT'),
    ('3ME037000SF', 'KARTON EXTRA JOSS 2 IN 1 EXP/380x257x170', 'RAPIPACK ASRITAMA, PT'),
    ('3ME037010', 'KARTON EXTRA JOSS 2 IN 1 EXP/374x256x169', 'RAPIPACK ASRITAMA, PT'),
    ('3ME037010SF', 'KARTON EXTRA JOSS 2 IN 1 EXP/374x256x169', 'RAPIPACK ASRITAMA, PT'),
    ('3ME037020', 'KARTON EXTRA JOSS 2 IN 1 EXP/374x256x169', 'RAPIPACK ASRITAMA, PT'),
    ('3ME037020', 'KARTON EXTRA JOSS 2 IN 1 EXP/374x256x169', 'OJI SINAR MAS PACKAGING, PT'),
    ('3ME037020', 'KARTON EXTRA JOSS 2 IN 1 EXP/374x256x169', 'MULTIBOX INDAH, PT'),
    ('3ME037020SF', 'KARTON EXTRA JOSS 2 IN 1 EXP/374x256x169', 'RAPIPACK ASRITAMA, PT'),
    ('3ME037020SF', 'KARTON EXTRA JOSS 2 IN 1 EXP/374x256x169', 'MULTIBOX INDAH, PT'),
    ('3ME037020SF', 'KARTON EXTRA JOSS 2 IN 1 EXP/374x256x169', 'OJI SINAR MAS PACKAGING, PT'),
    ('3ME037030', 'KARTON EXTRA JOSS 3 IN 1 EXP/374x256x169', 'OJI SINAR MAS PACKAGING, PT'),
    ('3ME037030SF', 'KARTON EXTRA JOSS 3 IN 1 EXP/374x256x169', 'OJI SINAR MAS PACKAGING, PT'),
    ('3ME041000', 'KARTON EXTRA JOSS ULTIMATE MAL/466x743', 'INDAH KIAT, PT'),
    ('3MF002000', 'KARTON FEMMY TRIMUNE/169x248x132', 'RAPIPACK ASRITAMA, PT'),
    ('3MF003000', 'KARTON FEMMY VARIAN/313x173x135', 'RAPIPACK ASRITAMA, PT'),
    ('3MJ001010', 'KARTON BEJO SUJAMER/372x190x133', 'RAPIPACK ASRITAMA, PT'),
    ('3MJ002020', 'KARTON BEJO SUJAMER/367x265x150', 'RAPIPACK ASRITAMA, PT'),
    ('3MJ003000', 'KARTON BEJO SUJAMER/372x220x135', 'RAPIPACK ASRITAMA, PT'),
    ('3MJ006000', 'KARTON BEJO SUJAMER MAL/372x190x133', 'RAPIPACK ASRITAMA, PT'),
    ('3MS001000', 'KARTON B7 SLA-SI 3IN1 /410x200x160', 'RAPIPACK ASRITAMA, PT'),
    ('3MS001010', 'KARTON B7 SLA-SI 3IN1 /410x200x160', ''),
    ('3MS002000', 'KARTON B7 SLA-SI JERUK NIPIS/340x202x135', 'RAPIPACK ASRITAMA, PT'),
    ('3MS002000', 'KARTON B7 SLA-SI JERUK NIPIS/340x202x135', 'OJI SINAR MAS PACKAGING, PT'),
    ('3MS002010', 'KARTON B7 SLA-SI JERUK NIPIS/340x202x135', 'OJI SINAR MAS PACKAGING, PT'),
    ('3MS002020', 'KARTON B7 SLA-SI JERUK NIPIS/340x202x135', 'OJI SINAR MAS PACKAGING, PT'),
    ('3MS002030', 'KARTON B7 SLA-SI JERUK NIPIS/340x202x135', ''),
    ('4HS001000', 'HANGER SLASI/205x135', 'GUNUNG KELUD WISESA, PT'),
    ('4KB001010', 'PLAKBAND BERLOGO (LEBAR 48 MM)', 'EKADHARMA INTERNATIONAL, PT'),
    ('4KB001010', 'PLAKBAND BERLOGO (LEBAR 48 MM)', 'TUNAS MITRA SUKSES, PT'),
    ('4KB001010', 'PLAKBAND BERLOGO (LEBAR 48 MM)', 'HASRI ANEKATAMA, PT'),
    ('4KB001010SF', 'PLAKBAND BERLOGO (LEBAR 48 MM)', 'EKADHARMA INTERNATIONAL, PT'),
    ('4KB001010SF', 'PLAKBAND BERLOGO (LEBAR 48 MM)', 'HASRI ANEKATAMA, PT'),
    ('4KB002000', 'CELLOTAPE LOGO KALBE (LEBAR 12 MM)', 'EKADHARMA INTERNATIONAL, PT'),
    ('4KB002000', 'CELLOTAPE LOGO KALBE (LEBAR 12 MM)', 'HASRI ANEKATAMA, PT'),
    ('4KB004000', 'PLAKBAND POLOS', 'NACHINDO TAPE INDUSTRY, PT.'),
    ('4KB006000', 'DESSICANT', 'SIGMACO SAKSAMA INDONESIA, PT.'),
    ('4KB006000', 'DESSICANT', 'SIGMACO SAKSAMA IMAGE, PT.'),
    ('4KD001000', 'PLASTIK/470x720', 'SINAR PLASTIK MULJONO INDRA,PT'),
    ('4KD001000', 'PLASTIK/470x720', 'ELFRIDA PLASTIK INDUSTRI, PT'),
    ('4KD002000', 'PLASTIK/750x1300', 'SINAR PLASTIK MULJONO INDRA,PT'),
    ('4KD002000', 'PLASTIK/750x1300', 'ELFRIDA PLASTIK INDUSTRI, PT'),
    ('4KD003000', 'PLASTIK/160X240+40', 'INTAN POLYNDO PERKASA, PT'),
    ('4KD003010', 'PLASTIK/160X240+40', 'INTAN POLYNDO PERKASA, PT'),
    ('4KD005000', 'PLASTIK/170x250', 'SINAR PLASTIK MULJONO INDRA,PT'),
    ('4KD005000', 'PLASTIK/170x250', 'ELFRIDA PLASTIK INDUSTRI, PT'),
    ('4KD006000', 'PLASTIK/300x400', 'SINAR PLASTIK MULJONO INDRA,PT'),
    ('4KD006000', 'PLASTIK/300x400', 'ELFRIDA PLASTIK INDUSTRI, PT'),
    ('4KD007000', 'PLASTIK/650X1100', 'DANKOS FARMA, PT.'),
    ('4KD007000', 'PLASTIK/650X1100', 'SINAR PLASTIK MULJONO INDRA,PT'),
    ('4KD007000', 'PLASTIK/650X1100', 'ELFRIDA PLASTIK INDUSTRI, PT'),
    ('4KD008000', 'PLASTIK BIRU/(700/400)X1000', ''),
    ('4KD008010', 'PLASTIK BIRU/(700/400)X1000', 'COSMO MAKMUR INDONESIA, PT'),
    ('4KD009000', 'BUBBLE WRAP/1200x50', 'PAMOS JAYA MANDIRI, PT'),
    ('4KD010000', 'PLASTIK/230X380', 'SINAR PLASTIK MULJONO INDRA,PT'),
    ('4KD010000', 'PLASTIK/230X380', 'ELFRIDA PLASTIK INDUSTRI, PT'),
    ('4KD011000', 'BUBBLE WRAP/1200x50', 'PAMOS JAYA MANDIRI, PT'),
    ('4KL003010', 'HOT MELT WHITE', 'TECHBOND MANUFACTURING SDN,BHD'),
    ('4KL003010', 'HOT MELT WHITE', 'HENKEL INDONESIA, PT'),
    ('4KL003010SF', 'HOT MELT WHITE', 'HENKEL INDONESIA, PT'),
    ('4KS001000', 'ISI STAPLER KARTON SEALER BEST PACK', 'MITRA MAJU, PD.'),
    ('4KS002010', 'STICKER LABEL PENIMBANGAN RM 10X9', 'SURYA SAMUDRA TEKNIKTAMA, PT'),
    ('4KS004030', 'STICKER LABEL PENIMBANGAN FG 8X8', 'SURYA SAMUDRA TEKNIKTAMA, PT'),
    ('4KS004050', 'STICKER LABEL PENIMBANGAN PRIME FG 8X8', 'SURYA SAMUDRA TEKNIKTAMA, PT'),
    ('4KS004060', 'STICKER LABEL PENIMBANGAN PRIME FG 8X8 WAX RESIN', 'SURYA SAMUDRA TEKNIKTAMA, PT'),
    ('4KS005000', 'RIBBON PENIMBANGAN RM 10X9', 'SURYA SAMUDRA TEKNIKTAMA, PT'),
    ('4KS006000', 'RIBBON PENIMBANGAN FG 8x8', 'SURYA SAMUDRA TEKNIKTAMA, PT'),
    ('4VE009020', 'OPP HEATSEALABLE 18 MIKRON/220x2000', 'ARGHA KARYA PRIMA INDUSTRY, PT'),
    ('4VE011010', 'OPP HEATSEALABLE 18 MIKRON/175x2000', 'ARGHA KARYA PRIMA INDUSTRY, PT'),
    ('4VE013000', 'OPP HEATSEALABLE 18 MIKRON/290x2000', 'ARGHA KARYA PRIMA INDUSTRY, PT'),
    ('4VE014000', 'OPP HEATSEALABLE 18 MIKRON/200x2000', 'ARGHA KARYA PRIMA INDUSTRY, PT')
ON CONFLICT (kode_item, manufacture) DO NOTHING;

