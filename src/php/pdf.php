<?php

declare(strict_types=1);

/**
 * Tiny PDF writer for one-page result certificates (no external dependency).
 */

function pdf_escape(string $text): string
{
    $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
    if ($ascii === false) {
        $ascii = preg_replace('/[^\x20-\x7E]/', '?', $text) ?? '';
    }
    return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], (string) $ascii);
}

/**
 * @param array<int, array{font:string, size:float, x:float, y:float, text:string}> $lines
 */
function pdf_document(string $title, array $lines): string
{
    $stream = '';
    foreach ($lines as $line) {
        $font = $line['font'] === 'mono' ? 'F2' : 'F1';
        $stream .= sprintf(
            "BT /%s %.1f Tf %.1f %.1f Td (%s) Tj ET\n",
            $font,
            (float) $line['size'],
            (float) $line['x'],
            (float) $line['y'],
            pdf_escape((string) $line['text']),
        );
    }

    $objects = [];
    $objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    $objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
    $objects[3] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        . "/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>";
    $objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
    $objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";
    $objects[6] = "<< /Length " . strlen($stream) . " >>\nstream\n" . $stream . "endstream";

    $pdf = "%PDF-1.4\n";
    $offsets = [0 => 0];
    for ($i = 1; $i <= 6; $i += 1) {
        $offsets[$i] = strlen($pdf);
        $pdf .= "{$i} 0 obj\n{$objects[$i]}\nendobj\n";
    }
    $xref = strlen($pdf);
    $pdf .= "xref\n0 7\n";
    $pdf .= "0000000000 65535 f \n";
    for ($i = 1; $i <= 6; $i += 1) {
        $pdf .= sprintf("%010d 00000 n \n", $offsets[$i]);
    }
    $pdf .= "trailer\n<< /Size 7 /Root 1 0 R >>\n";
    $pdf .= "startxref\n{$xref}\n%%EOF\n";

    return $pdf;
}
