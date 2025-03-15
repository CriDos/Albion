import sys
import json
import os
from PyQt5.QtWidgets import (QApplication, QMainWindow, QLabel, QVBoxLayout, QHBoxLayout, 
                            QWidget, QPushButton, QFileDialog, QTableWidget, QTableWidgetItem,
                            QHeaderView, QLineEdit, QGroupBox, QFormLayout)
from PyQt5.QtCore import Qt, QMimeData
from PyQt5.QtGui import QDragEnterEvent, QDropEvent

class AlbionMarketAnalyzer(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Анализатор рынка Albion")
        self.setMinimumSize(1000, 600)
        
        # Данные
        self.data = []
        self.filtered_data = []
        self.current_sort_column = 8  # По умолчанию сортировка по колонке "Прибыль"
        self.sort_ascending = False
        
        # Настройка интерфейса
        self.setup_ui()
        
        # Поддержка Drag & Drop
        self.setAcceptDrops(True)
    
    def setup_ui(self):
        # Главный виджет и компоновка
        main_widget = QWidget()
        main_layout = QVBoxLayout(main_widget)
        self.setCentralWidget(main_widget)
        
        # Область перетаскивания файлов
        self.drop_label = QLabel("Перетащите JSON файл сюда или нажмите кнопку 'Открыть файл'")
        self.drop_label.setAlignment(Qt.AlignCenter)
        self.drop_label.setStyleSheet("""
            QLabel {
                border: 2px dashed #aaa;
                border-radius: 5px;
                padding: 20px;
                background-color: #f8f8f8;
            }
        """)
        main_layout.addWidget(self.drop_label)
        
        # Кнопка выбора файла
        self.open_button = QPushButton("Открыть файл")
        self.open_button.clicked.connect(self.open_file_dialog)
        main_layout.addWidget(self.open_button)
        
        # Настройки фильтрации
        filter_layout = QHBoxLayout()
        
        # Группа фильтров
        filter_group = QGroupBox("Фильтры")
        filter_form_layout = QFormLayout()
        
        # Фильтры для числовых полей
        self.min_buy_price = QLineEdit()
        self.max_buy_price = QLineEdit()
        filter_form_layout.addRow("Мин. цена покупки:", self.min_buy_price)
        filter_form_layout.addRow("Макс. цена покупки:", self.max_buy_price)
        
        self.min_sell_price = QLineEdit()
        self.max_sell_price = QLineEdit()
        filter_form_layout.addRow("Мин. цена продажи:", self.min_sell_price)
        filter_form_layout.addRow("Макс. цена продажи:", self.max_sell_price)
        
        self.min_profit = QLineEdit()
        self.max_profit = QLineEdit()
        filter_form_layout.addRow("Мин. прибыль:", self.min_profit)
        filter_form_layout.addRow("Макс. прибыль:", self.max_profit)
        
        self.min_profit_percent = QLineEdit()
        self.max_profit_percent = QLineEdit()
        filter_form_layout.addRow("Мин. процент прибыли:", self.min_profit_percent)
        filter_form_layout.addRow("Макс. процент прибыли:", self.max_profit_percent)
        
        self.min_sold_per_day = QLineEdit()
        self.max_sold_per_day = QLineEdit()
        filter_form_layout.addRow("Мин. продаж в день:", self.min_sold_per_day)
        filter_form_layout.addRow("Макс. продаж в день:", self.max_sold_per_day)
        
        self.apply_filter_button = QPushButton("Применить фильтры")
        self.apply_filter_button.clicked.connect(self.apply_filters)
        filter_form_layout.addWidget(self.apply_filter_button)
        
        self.reset_filter_button = QPushButton("Сбросить фильтры")
        self.reset_filter_button.clicked.connect(self.reset_filters)
        filter_form_layout.addWidget(self.reset_filter_button)
        
        filter_group.setLayout(filter_form_layout)
        filter_layout.addWidget(filter_group)
        
        main_layout.addLayout(filter_layout)
        
        # Таблица для отображения данных
        self.table = QTableWidget()
        self.table.setColumnCount(11)
        
        # Заголовки колонок
        headers = [
            "Название", "Изображение", "Цена покупки", "Время покупки", 
            "Цена продажи", "Время продажи", "Откуда", "Куда", 
            "Прибыль", "% прибыли", "Продаж/день"
        ]
        self.table.setHorizontalHeaderLabels(headers)
        
        # Настройка заголовков для сортировки
        self.table.horizontalHeader().setSectionsClickable(True)
        self.table.horizontalHeader().sectionClicked.connect(self.header_clicked)
        
        # Настройка растягивания колонок
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        
        main_layout.addWidget(self.table)
        
        # Статус
        self.status_label = QLabel("Готов к работе")
        main_layout.addWidget(self.status_label)
    
    def header_clicked(self, column_index):
        # Если кликнули по той же колонке - меняем порядок сортировки
        if column_index == self.current_sort_column:
            self.sort_ascending = not self.sort_ascending
        else:
            # Если по другой колонке - запоминаем новую колонку и сбрасываем порядок сортировки
            self.current_sort_column = column_index
            self.sort_ascending = True
        
        # Применяем сортировку
        self.sort_table_by_column(column_index)
        
        # Обновляем статус
        column_name = self.table.horizontalHeaderItem(column_index).text()
        order_text = "по возрастанию" if self.sort_ascending else "по убыванию"
        self.status_label.setText(f"Данные отсортированы по полю '{column_name}' {order_text}")
    
    def sort_table_by_column(self, column_index):
        if not self.filtered_data:
            return
        
        # Сопоставление индекса колонки с полем в данных
        column_to_field = {
            0: "title",
            1: "image",
            2: "buyPrice",
            3: "buyTimeAgo",
            4: "sellPrice",
            5: "sellTimeAgo",
            6: "fromLocation",
            7: "toLocation",
            8: "profit",
            9: "profitPercent",
            10: "soldPerDay"
        }
        
        field_name = column_to_field[column_index]
        
        # Сортируем данные
        self.filtered_data.sort(
            key=lambda x: x.get(field_name, ""), 
            reverse=not self.sort_ascending
        )
        
        # Обновляем таблицу
        self.update_table()
    
    def dragEnterEvent(self, event: QDragEnterEvent):
        if event.mimeData().hasUrls() and event.mimeData().urls()[0].toLocalFile().endswith('.json'):
            event.acceptProposedAction()
            self.drop_label.setStyleSheet("""
                QLabel {
                    border: 2px dashed #4CAF50;
                    border-radius: 5px;
                    padding: 20px;
                    background-color: #e8f5e9;
                }
            """)
    
    def dragLeaveEvent(self, event):
        self.drop_label.setStyleSheet("""
            QLabel {
                border: 2px dashed #aaa;
                border-radius: 5px;
                padding: 20px;
                background-color: #f8f8f8;
            }
        """)
    
    def dropEvent(self, event: QDropEvent):
        self.drop_label.setStyleSheet("""
            QLabel {
                border: 2px dashed #aaa;
                border-radius: 5px;
                padding: 20px;
                background-color: #f8f8f8;
            }
        """)
        
        file_path = event.mimeData().urls()[0].toLocalFile()
        self.load_json_file(file_path)
    
    def open_file_dialog(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "Открыть JSON файл", "", "JSON файлы (*.json)"
        )
        if file_path:
            self.load_json_file(file_path)
    
    def load_json_file(self, file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                self.data = json.load(f)
            
            # Преобразование строковых значений в числовые
            for item in self.data:
                for field in ['buyPrice', 'sellPrice', 'profit', 'profitPercent', 'soldPerDay']:
                    try:
                        item[field] = float(item[field])
                    except (ValueError, TypeError):
                        item[field] = 0.0
            
            self.status_label.setText(f"Загружено {len(self.data)} записей из {os.path.basename(file_path)}")
            
            # Применяем фильтры и сортировку
            self.apply_filters()
            
        except Exception as e:
            self.status_label.setText(f"Ошибка при загрузке файла: {str(e)}")
    
    def apply_filters(self):
        if not self.data:
            return
        
        self.filtered_data = self.data.copy()
        
        # Применяем фильтры
        try:
            # Цена покупки
            if self.min_buy_price.text():
                min_val = float(self.min_buy_price.text())
                self.filtered_data = [item for item in self.filtered_data if item['buyPrice'] >= min_val]
            
            if self.max_buy_price.text():
                max_val = float(self.max_buy_price.text())
                self.filtered_data = [item for item in self.filtered_data if item['buyPrice'] <= max_val]
            
            # Цена продажи
            if self.min_sell_price.text():
                min_val = float(self.min_sell_price.text())
                self.filtered_data = [item for item in self.filtered_data if item['sellPrice'] >= min_val]
            
            if self.max_sell_price.text():
                max_val = float(self.max_sell_price.text())
                self.filtered_data = [item for item in self.filtered_data if item['sellPrice'] <= max_val]
            
            # Прибыль
            if self.min_profit.text():
                min_val = float(self.min_profit.text())
                self.filtered_data = [item for item in self.filtered_data if item['profit'] >= min_val]
            
            if self.max_profit.text():
                max_val = float(self.max_profit.text())
                self.filtered_data = [item for item in self.filtered_data if item['profit'] <= max_val]
            
            # Процент прибыли
            if self.min_profit_percent.text():
                min_val = float(self.min_profit_percent.text())
                self.filtered_data = [item for item in self.filtered_data if item['profitPercent'] >= min_val]
            
            if self.max_profit_percent.text():
                max_val = float(self.max_profit_percent.text())
                self.filtered_data = [item for item in self.filtered_data if item['profitPercent'] <= max_val]
            
            # Продаж в день
            if self.min_sold_per_day.text():
                min_val = float(self.min_sold_per_day.text())
                self.filtered_data = [item for item in self.filtered_data if item['soldPerDay'] >= min_val]
            
            if self.max_sold_per_day.text():
                max_val = float(self.max_sold_per_day.text())
                self.filtered_data = [item for item in self.filtered_data if item['soldPerDay'] <= max_val]
            
            # Применяем текущую сортировку
            self.sort_table_by_column(self.current_sort_column)
            
            self.status_label.setText(f"Отфильтровано: {len(self.filtered_data)} из {len(self.data)} записей")
            
        except ValueError as e:
            self.status_label.setText(f"Ошибка ввода: {str(e)}")
    
    def reset_filters(self):
        # Очищаем все поля фильтров
        self.min_buy_price.clear()
        self.max_buy_price.clear()
        self.min_sell_price.clear()
        self.max_sell_price.clear()
        self.min_profit.clear()
        self.max_profit.clear()
        self.min_profit_percent.clear()
        self.max_profit_percent.clear()
        self.min_sold_per_day.clear()
        self.max_sold_per_day.clear()
        
        if self.data:
            # Сбрасываем фильтры
            self.filtered_data = self.data.copy()
            # Применяем текущую сортировку
            self.sort_table_by_column(self.current_sort_column)
            
            self.status_label.setText(f"Фильтры сброшены. Отображено {len(self.filtered_data)} записей")
    
    def update_table(self):
        self.table.setRowCount(0)  # Очищаем таблицу
        
        for row, item in enumerate(self.filtered_data):
            self.table.insertRow(row)
            
            # Заполняем ячейки таблицы
            self.table.setItem(row, 0, QTableWidgetItem(item['title']))
            self.table.setItem(row, 1, QTableWidgetItem(os.path.basename(item['image'])))
            self.table.setItem(row, 2, QTableWidgetItem(str(item['buyPrice'])))
            self.table.setItem(row, 3, QTableWidgetItem(item['buyTimeAgo']))
            self.table.setItem(row, 4, QTableWidgetItem(str(item['sellPrice'])))
            self.table.setItem(row, 5, QTableWidgetItem(item['sellTimeAgo']))
            self.table.setItem(row, 6, QTableWidgetItem(item['fromLocation']))
            self.table.setItem(row, 7, QTableWidgetItem(item['toLocation']))
            self.table.setItem(row, 8, QTableWidgetItem(str(item['profit'])))
            self.table.setItem(row, 9, QTableWidgetItem(str(item['profitPercent'])))
            self.table.setItem(row, 10, QTableWidgetItem(str(item['soldPerDay'])))
            
            # Форматирование ячеек с прибылью
            profit_item = self.table.item(row, 8)
            profit_percent_item = self.table.item(row, 9)
            
            if item['profit'] > 0:
                profit_item.setForeground(Qt.green)
                profit_percent_item.setForeground(Qt.green)
            else:
                profit_item.setForeground(Qt.red)
                profit_percent_item.setForeground(Qt.red)

def main():
    app = QApplication(sys.argv)
    window = AlbionMarketAnalyzer()
    window.show()
    sys.exit(app.exec_())

if __name__ == "__main__":
    main() 