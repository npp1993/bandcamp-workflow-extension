import {Logger} from '../utils/logger';

/**
 * Service for helping download Bandcamp purchased tracks
 * Adds a button to generate a cURL script for batch downloading
 */
export class DownloadHelperService {
  private button: HTMLButtonElement;
  private eventListenerAttached: boolean = false;
  private expectedItemCount: number = 0;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize the download helper
   */
  public init(): void {
    this.expectedItemCount = this.getExpectedItemCount();
    this.createButton();
    this.checkDownloadLinks();

    // Poll every 2 seconds until all links are ready
    this.pollInterval = setInterval(() => {
      this.checkDownloadLinks();
    }, 2000);
  }

  /**
   * Create the download button and add it to the page
   */
  private createButton(): void {
    if (this.button) {
      return;
    }

    // Check for bulk download structure first, then single item
    const bulkContainer = document.querySelector('.download-titles');
    const singleContainer = document.querySelector('.download-item-container');
    
    let location: Element | null = null;
    
    if (bulkContainer) {
      // Bulk download page - place button in the download-titles container
      location = bulkContainer;
      Logger.debug('Placing button in bulk container (.download-titles)');
    } else if (singleContainer) {
      // Single download page - place button in the download-item-container
      location = singleContainer;
      Logger.debug('Placing button in single container (.download-item-container)');
    }
    
    if (!location) {
      Logger.debug('No suitable location found for download button');
      return;
    }

    this.button = document.createElement('button');
    this.button.title = "Generates a file for automating downloads using 'cURL'";
    this.button.className = 'bandcamp-workflow-download-all';
    this.button.disabled = true;
    this.button.textContent = 'Preparing download...';

    location.append(this.button);
    Logger.debug('Download button created and added to page');
  }

  /**
   * Enable the download button when all links are ready
   */
  private enableButton(): void {
    if (!this.button) {
      return;
    }

    this.button.disabled = false;
    this.button.textContent = 'Download curl script';

    // Stop polling once all links are ready
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Only add event listener if not already attached
    if (!this.eventListenerAttached) {
      this.button.addEventListener('click', () => {
        const date = this.formatDate();
        const downloadList = this.generateDownloadList();
        const preamble = this.getDownloadPreamble();
        const postamble = this.getDownloadPostamble();
        const downloadDocument = preamble + downloadList + postamble;

        this.downloadFile(`bandcamp_${date}.txt`, downloadDocument);
      });

      this.eventListenerAttached = true;
    }
  }

  /**
   * Disable the download button when links are not ready
   */
  private disableButton(readyCount: number): void {
    if (!this.button) {
      return;
    }

    this.button.disabled = true;
    if (this.expectedItemCount > 0) {
      this.button.textContent = `Preparing download... (${readyCount}/${this.expectedItemCount})`;
    } else {
      this.button.textContent = 'Preparing download...';
    }
  }

  /**
   * Check if download links are ready
   */
  private checkDownloadLinks(): void {
    this.updateButtonState();
  }

  /**
   * Get the expected number of downloadable items on the page
   */
  private getExpectedItemCount(): number {
    // Bulk download page: each li.download_list_item is one purchaseable item
    const bulkItems = document.querySelectorAll('li.download_list_item');
    if (bulkItems.length > 0) {
      return bulkItems.length;
    }

    // Single download page: just one item
    const singleContainer = document.querySelector('.download-item-container');
    if (singleContainer) {
      return 1;
    }

    return 0;
  }

  /**
   * Count how many items currently have a ready download link
   */
  private getReadyItemCount(): number {
    // Bulk: count list items that have a visible .item-button with a valid href
    const bulkItems = document.querySelectorAll('li.download_list_item');
    if (bulkItems.length > 0) {
      let ready = 0;
      bulkItems.forEach(item => {
        const btn = item.querySelector('.download-title .item-button[href]');
        if (btn) {
          const href = btn.getAttribute('href');
          const isVisible = (btn as HTMLElement).style.display !== 'none';
          if (href && href.length > 0 && isVisible) {
            ready++;
          }
        }
      });
      return ready;
    }

    // Single: check for any download link
    const singleLinks = document.querySelectorAll('a[href*="/download/"]');
    return Array.from(singleLinks).filter(link => {
      const href = link.getAttribute('href');
      const isVisible = (link as HTMLElement).style.display !== 'none';
      return href && href.length > 0 && isVisible;
    }).length;
  }

  /**
   * Check readiness of all download links and update button state
   */
  private updateButtonState(): void {
    // Re-check expected count in case items were added dynamically
    const currentExpected = this.getExpectedItemCount();
    if (currentExpected > this.expectedItemCount) {
      this.expectedItemCount = currentExpected;
    }

    const readyCount = this.getReadyItemCount();

    if (this.expectedItemCount === 0) {
      return;
    }

    Logger.debug(`Download links ready: ${readyCount}/${this.expectedItemCount}`);

    if (readyCount >= this.expectedItemCount) {
      this.enableButton();
    } else {
      this.disableButton(readyCount);
    }
  }

  /**
   * Generate the list of download URLs
   */
  private generateDownloadList(): string {
    // Get download links using specific selectors for each page type
    const bulkLinks = document.querySelectorAll('li.download_list_item .download-title .item-button[href]');
    const singleLinks = document.querySelectorAll('a[href*="/download/"]');
    
    const urls = new Set<string>();
    
    // Add bulk download links
    bulkLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href) urls.add(href);
    });
    
    // Add single download links  
    singleLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href) urls.add(href);
    });
    
    if (urls.size === 0) {
      return 'URLS=()\n';
    }
    
    const fileList = Array.from(urls).map((url) => `\t"${url}"`).join('\n');
    return 'URLS=(\n' + fileList + '\n)\n';
  }

  /**
   * Format the current date for filename
   */
  private formatDate(): string {
    const currentdate = new Date();
    const year = String(currentdate.getFullYear()).slice(-2);
    const month = String(currentdate.getMonth() + 1).padStart(2, '0');
    const day = String(currentdate.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  /**
   * Download a file with the given name and content
   */
  private downloadFile(filename: string, text: string): void {
    const element = document.createElement('a');
    
    element.setAttribute(
      'href',
      'data:text/plain;charset=utf-8,' + encodeURIComponent(text),
    );
    element.setAttribute('download', filename);
    
    element.style.display = 'none';
    document.body.appendChild(element);
    
    element.click();
    
    document.body.removeChild(element);
  }

  /**
   * Get the preamble for the download script
   */
  private getDownloadPreamble(): string {
    return `#!/usr/bin/env bash

# Generated by Bandcamp Workflow Extension
#
# The following can be used to batch download your recent purchases.
# All downloaded files and extracted folders will be organized in a "bandcamp" folder.
# 
# Usage (Mac/Linux):
# 1) open Terminal
# 2) move to desired download directory (e.g. \`cd ~/Downloads/bandcamp\`)
# 3) run script (e.g. \`bash <this filename>.txt\` or \`. ./<this filename>.txt\`)

`;
  }

  /**
   * Get the postamble (implementation) for the download script
   */
  private getDownloadPostamble(): string {
    return `
# Configuration
DEFAULT_BATCH_SIZE=3

# Setup base folder for downloads
BASE_FOLDER="bandcamp"

# Create the base folder if it doesn't exist
mkdir -p "$BASE_FOLDER"

# Function to download a file silently, with minimal output
download_file() {
    local url="$1"
    local file_id="$2"
    
    # Change to the base folder before downloading
    cd "$BASE_FOLDER"
    
    # Use curl with silent mode, only showing errors
    # -L: follow redirects
    # -O: save with remote filename
    # -J: use content-disposition header filename if available
    # -s: silent mode
    local result=0
    if curl -L -O -J -s "$url"; then
        result=0
    else
        result=1
    fi
    
    # Return to parent directory
    cd ..
    
    return $result
}

# Function to extract zip files in the base folder
extract_zip_files() {
    echo ""
    echo "=== Looking for zip files to extract ==="
    
    # Check for zip files in the base folder
    cd "$BASE_FOLDER" 2>/dev/null || {
        echo "Base folder $BASE_FOLDER not found. No zip files to extract."
        return 0
    }
    
    # Count the number of zip files
    ZIP_COUNT=$(find . -maxdepth 1 -name "*.zip" | wc -l | tr -d ' ')
    
    if [ "$ZIP_COUNT" -eq 0 ]; then
        echo "No zip files found to extract."
        cd ..
        return 0
    fi
    
    echo "Found $ZIP_COUNT zip files to extract."
    
    # Extract each zip file within the base folder
    EXTRACTED=0
    EXTRACT_FAILED=0
    
    for zip_file in *.zip; do
        # Skip if no zip files match the pattern
        [ "$zip_file" = "*.zip" ] && break
        
        # Create directory name from zip filename (remove .zip extension)
        dir_name="\${zip_file%.zip}"
        
        echo "Extracting: $zip_file to $dir_name/"
        
        # Create directory if it doesn't exist
        mkdir -p "$dir_name"
        
        if unzip -q "$zip_file" -d "$dir_name"; then
            echo "Successfully extracted $zip_file to $dir_name/"
            ((EXTRACTED++))
        else
            echo "Failed to extract $zip_file"
            ((EXTRACT_FAILED++))
            # Remove directory if extraction failed
            rmdir "$dir_name" 2>/dev/null
        fi
    done
    
    cd ..
    
    echo ""
    echo "=== Extraction complete: $EXTRACTED successful, $EXTRACT_FAILED failed ==="
    
    if [ "$EXTRACTED" -gt 0 ]; then
        echo "All files and extractions are in the '$BASE_FOLDER' folder"
    fi
}

# Variables
TOTAL_URLS=\${#URLS[@]}
COMPLETED=0
FAILED=0
BATCH_SIZE=\${1:-$DEFAULT_BATCH_SIZE}

# Instructions
if [ "$BATCH_SIZE" -eq "$DEFAULT_BATCH_SIZE" ] && [ -z "$1" ]; then
    echo "Note: You can set the number of concurrent downloads with: $0 <number>"
    echo "      For example: $0 5"
fi

echo ""
echo "=== Starting download of $TOTAL_URLS files (concurrent downloads: $BATCH_SIZE) ==="
echo ""

# Main download loop
for ((i=0; i<TOTAL_URLS; i+=BATCH_SIZE)); do
    pids=()
    
    # Start a batch of downloads
    for ((j=i; j<i+BATCH_SIZE && j<TOTAL_URLS; j++)); do
        file_id=$((j+1))
        download_file "\${URLS[j]}" "$file_id" &
        pids+=($!)
    done
    
    # Wait for all downloads in this batch to complete
    for pid in "\${pids[@]}"; do
        wait $pid
        status=$?
        if [ $status -eq 0 ]; then
            ((COMPLETED++))
        else
            ((FAILED++))
        fi
        
        # Print progress after each file completes
        percent=$((COMPLETED * 100 / TOTAL_URLS))
        echo "Progress: $COMPLETED/$TOTAL_URLS files ($percent%)"
    done
done

echo ""
if [ $FAILED -eq 0 ]; then
    echo "SUCCESS: Downloaded all $TOTAL_URLS files to '$BASE_FOLDER' folder"
else
    echo "WARNING: $FAILED of $TOTAL_URLS files failed to download"
fi

# Extract any zip files that were downloaded
extract_zip_files

echo ""
# Use stty -echo to suppress input display, then read the key, then restore with stty echo
echo -n "Press any key to exit..."
stty -echo
read -n 1
stty echo
echo # Add a newline after the keypress

exit $FAILED
`;
  }
}
